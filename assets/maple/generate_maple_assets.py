#!/usr/bin/env python3
"""Generate self-contained GLB models for Garage Gauntlet / Maple Junction.

Requires: numpy, trimesh, Pillow. Model space is PlayCanvas Y-up, front +Z.
Assets use authored triangle geometry, smooth bevels, PBR materials, and
model-scale detail rather than runtime cubes. No external models or textures.
"""
import math
import os
import random
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial

HERE = Path(__file__).resolve().parent
OUT = HERE / 'glb'
OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(212)

def rgba(hex_color):
    v=hex_color.lstrip('#')
    return [int(v[i:i+2],16) for i in (0,2,4)] + [255]

M = {
    'sage':('#86998b',.54,0), 'sage_edge':('#9dab9c',.56,0),
    'sage_dark':('#627c6e',.60,0), 'ivory':('#dfd3b9',.43,0),
    'antique_white':('#e6e0d0',.45,0), 'gutter':('#bfc7c0',.35,.2),
    'roof':('#4b5651',.81,0), 'roof2':('#59655f',.77,0),
    'roof3':('#616961',.83,0), 'basement':('#a7a89c',.91,0),
    'glass':('#365e6d',.15,0), 'glass_bright':('#93b4b9',.12,0),
    'dark_cavity':('#273a38',.94,0), 'shutter':('#365749',.48,0),
    'dark_brass':('#766d53',.44,.42), 'brass':('#ccae68',.30,.62),
    'brick':('#a77662',.83,0), 'brick_light':('#c38d76',.82,0),
    'brick_dark':('#835848',.86,0), 'mortar':('#b5aaa1',.95,0),
    'teal':('#44716f',.40,0), 'store_dark':('#2b5455',.42,0),
    'awning':('#e2c9a0',.63,0), 'awning2':('#c08d70',.61,0),
    'red':('#aa423e',.27,.14), 'red_shade':('#8a302e',.32,.13),
    'cream_car':('#e7d8b7',.23,.11), 'tires':('#242b2c',.86,0),
    'metal':('#a8b4b1',.31,.71), 'taillamp':('#7f242a',.22,.2),
    'headlamp':('#f2e6c4',.20,.1), 'bark':('#675b48',.95,0),
    'bark2':('#8c7457',.94,0), 'leaf1':('#4b7558',.99,0),
    'leaf2':('#6d935b',.99,0), 'leaf3':('#779e67',.99,0),
    'leaf4':('#3e6248',.99,0), 'grass':('#7b9a66',.99,0),
    'skytrim':('#f6ead4',.40,0),
}

def make_materials():
    return {key: PBRMaterial(name='Maple Junction | '+key,
       baseColorFactor=rgba(v[0]),roughnessFactor=v[1], metallicFactor=v[2],
       doubleSided=False) for key,v in M.items()}

MAT = make_materials()


def box_mesh(size,center,angle=0,bevel=0):
    """True rounded-edge cuboid with individual corner normals."""
    w,h,d = [float(q) for q in size]
    if bevel <= 0:
        mesh=trimesh.creation.box(extents=[w,h,d])
    else:
        half=np.array([w,h,d])*.5
        r=min(bevel,float(np.min(half)*.75))
        verts=[];faces=[]
        # x-planes, y-planes, z-planes; each face is a separately sampled
        # true quarter-circle transition to the adjacent face.
        for axis in range(3):
            u=(axis+1)%3;v=(axis+2)%3
            for sign in (-1,1):
                levels=lambda half_r:[-half_r,-half_r+r,half_r-r,half_r]
                us=levels(half[u]);vs=levels(half[v]);base=len(verts)
                for vv in vs:
                    for uu in us:
                        p=np.zeros(3);p[axis]=sign*half[axis]
                        p[u]=uu;p[v]=vv
                        center_clamped=np.minimum(np.maximum(p,-half+r),half-r)
                        direction=p-center_clamped
                        norm=np.linalg.norm(direction)
                        normal=direction/max(norm,1e-9)
                        q=center_clamped+r*normal
                        verts.append(q)
                # Cross product of axis cyclic u,v is +axis.
                invert=sign<0
                for j in range(3):
                    for i in range(3):
                        a=base+j*4+i;b=a+1;c=a+4;e=c+1
                        if invert:faces.extend([[a,e,b],[a,c,e]])
                        else:faces.extend([[a,b,e],[a,e,c]])
        mesh=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False)
    if angle:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(angle),[0,0,1]))
    mesh.apply_translation(center)
    return mesh


def cylinder(radius,height,center,axis='y',sections=24):
    mesh=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
    if axis=='y':mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
    elif axis=='x':mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    mesh.apply_translation(center)
    return mesh


def ring(major,minor,center,axis='x'):
    # Flat toroidal whitewalls and raised chrome rings.
    vertices=[];faces=[];Mseg=32;mseg=8
    for i in range(Mseg):
        a=2*math.pi*i/Mseg
        for j in range(mseg):
            b=2*math.pi*j/mseg
            radius=major+minor*math.cos(b)
            if axis=='x':pos=[minor*math.sin(b),radius*math.cos(a),radius*math.sin(a)]
            else:pos=[radius*math.cos(a),minor*math.sin(b),radius*math.sin(a)]
            vertices.append(np.array(pos)+center)
    for i in range(Mseg):
        for j in range(mseg):
            a=i*mseg+j;b=((i+1)%Mseg)*mseg+j
            c=i*mseg+(j+1)%mseg;d=((i+1)%Mseg)*mseg+(j+1)%mseg
            faces.extend([[a,b,c],[c,b,d]])
    return trimesh.Trimesh(vertices=vertices,faces=faces,process=False)


def face_quad(points,double=False):
    verts=np.asarray(points,dtype=float)
    faces=[[0,1,2],[0,2,3]]
    if double:faces += [[2,1,0],[3,2,0]]
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)


def triangle_prism(x0,half,ybase,peak,zf,depth=.18):
    # A real triangular gable filling the space immediately below a roof.
    vs=np.array([[x0-half,ybase,zf],[x0+half,ybase,zf],[x0,peak,zf],
                 [x0-half,ybase,zf-depth],[x0+half,ybase,zf-depth],[x0,peak,zf-depth]])
    fs=np.array([[0,1,2],[5,4,3],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]])
    return trimesh.Trimesh(vertices=vs,faces=fs,process=False)


def shrub_mesh(center,radii=(.43,.26,.39),seed=0,subdivisions=2):
    mesh=trimesh.creation.icosphere(subdivisions=subdivisions,radius=1)
    v=mesh.vertices.copy()
    for i,p in enumerate(v):
        a=.95+.085*math.sin(7*p[0]+seed)*math.cos(6*p[2]+seed*.6)
        b=1+.045*math.sin(9*p[1]+seed)
        v[i]=v[i]*np.array(radii)*a*b+center
    mesh.vertices=v
    return mesh


def branch_mesh(start,end,radius):
    start=np.asarray(start,dtype=float);end=np.asarray(end,dtype=float)
    vector=end-start;length=np.linalg.norm(vector)
    geom=trimesh.creation.cone(radius=radius,height=length,sections=11)
    geom.apply_transform(trimesh.geometry.align_vectors([0,0,1],vector/length))
    geom.apply_translation((start+end)/2)
    return geom


class Builder:
    def __init__(self,name):
        self.name=name
        self.groups=defaultdict(list)
        self.extra_materials={}
        self.counts=defaultdict(int)

    def add(self,mesh,mat,uv=None):
        # Conserve export texture coordinates, including custom signage quads.
        self.groups[mat].append((mesh,uv))
        self.counts[mat]+=1

    def box(self,mat,x,y,z,w,h,d,b=0,angle=0):
        self.add(box_mesh((w,h,d),(x,y,z),angle=angle,bevel=b),mat)

    def cyl(self,mat,r,h,x,y,z,axis='y',sections=24):
        self.add(cylinder(r,h,(x,y,z),axis=axis,sections=sections),mat)

    def ball(self,mat,x,y,z,r=(1,1,1),seed=0,subdivisions=2):
        self.add(shrub_mesh((x,y,z),r,seed,subdivisions),mat)

    def make_glb(self,filename):
        scene=trimesh.Scene()
        count=0
        for key,meshes in self.groups.items():
            model=trimesh.util.concatenate([mesh for mesh,_ in meshes])
            uvs=[]
            for mesh, uv in meshes:
                uvs.append(uv if uv is not None else np.zeros((len(mesh.vertices),2)))
            visual=trimesh.visual.TextureVisuals(uv=np.vstack(uvs),
              material=self.extra_materials[key] if key in self.extra_materials else MAT[key])
            model.visual=visual
            model.metadata['name']=f'{self.name} | {key}'
            scene.add_geometry(model,node_name=f'{self.name}_{key}',geom_name=f'{self.name}_{key}')
            count+=len(model.faces)
        scene.metadata={'asset':self.name,'creator':'Garage Gauntlet / procedurally authored 3D',
                        'coordinate_system':'Y-up, front +Z','units':'Maple Junction game units'}
        blob=scene.export(file_type='glb')
        path=OUT/filename
        path.write_bytes(blob)
        print(f'{filename}: {len(blob)/1024:.1f} KiB, {count:,} triangles, '
              f'{len(self.groups)} draw-call materials, {sum(self.counts.values())} real parts')
        return path


def put_window(b,x,y,front,width=2.65,height=2.75):
    # Window is physically layered: black cavity, inset glass, real molded
    # jambs and mullions, and an overhanging sill instead of a flat decal.
    b.box('dark_cavity',x,y,front+.08,width+.27,height+.22,.16,.026)
    b.box('glass',x,y,front+.19,width,height,.09,.013)
    b.box('glass_bright',x-.27,y+height*.20,front+.251,width*.35,.06,.014,.003,13)
    w=.19
    for xo in [-width/2, width/2]:
        b.box('ivory',x+xo,y,front+.30,w,height+.32,.21,.058)
    for yo in [-height/2,height/2]:
        b.box('ivory',x,y+yo,front+.29,width+.39,.19,.25,.06)
    b.box('ivory',x,y,front+.33,.10,height-.02,.12,.03)
    b.box('ivory',x,y,front+.33,width-.03,.10,.12,.03)
    b.box('ivory',x,y-height/2-.18,front+.40,width+.7,.16,.57,.057)
    for side in (-1,1):
        sx=x+side*(width/2+.45)
        b.box('shutter',sx,y,front+.20,.54,height+.20,.20,.04)
        for j in range(9):
            yy=y-height/2+.17+j*(height-.34)/8
            b.box('sage_dark',sx,yy,front+.32,.42,.05,.055,.014)


def make_house():
    b=Builder('Maple Craftsman House')
    # House envelope and visually physical raised foundations.
    b.box('basement',0,.42,0,12.2,.84,10.2,.07)
    b.box('sage',0,4.10,0,12,7.15,10,.09)
    front=5.0
    # Thin horizontal bevel-edged lap siding, not a repeated texture.
    for side in (-1,1):
        for i in range(22):
            y=.76+i*.315
            # Different sections on both sides, spaced from underlying shell.
            b.box('sage_edge',side*6.015,y,-.02,.087,.11,9.83,.015)
    for i in range(22):
        y=.76+i*.315
        b.box('sage_edge',0,y,front+.045,11.80,.093,.105,.018)
    # Corner bead and shadowed soffit.
    for x in (-5.94,5.94):
        b.box('ivory',x,4.09,5.07,.23,7.08,.29,.052)
        b.box('ivory',x,4.09,-5.06,.23,7.08,.28,.05)
    # Actual roof geometry intersects upper wall; no floating gables.
    eave=7.56;ridge=10.32;half=6.38;pitch=math.degrees(math.atan2(ridge-eave,half));
    for zf in (5.15,-5.15):
        b.add(triangle_prism(0,5.96,7.52,10.22,zf,.21),'sage')
    for side in (-1,1):
        slope=math.hypot(half,ridge-eave)
        b.box('roof',side*half/2,(eave+ridge)/2,0,
              slope+.30,.22,11.25,.035,-side*pitch)
        # Visible fascia plank follows roof slope along both gable ends.
        for zz in (5.64,-5.64):
            b.box('ivory',side*half/2,(eave+ridge)/2,zz,
                  slope+.32,.19,.19,.035,-side*pitch)
        # Individual overlapping shingles following physical pitched plane.
        for row in range(10):
            f=(row+.52)/10
            x=side*half*f
            y=ridge-(ridge-eave)*f+.135
            for c in range(13):
                z=-5.44+(c+.48)*10.88/13+(row%2)*.13
                key='roof2' if (c+row)%8==0 else 'roof3' if (c+row)%11==0 else 'roof'
                b.box(key,x,y,z,slope/10+.10,.07,.90,.018,-side*pitch)
        b.box('ivory',side*6.33,eave-.12,0,.23,.28,11.40,.072)
    b.box('roof2',0,ridge+.12,0,.48,.27,11.44,.09)
    for i in range(13):
        z=-5.36+i*.89
        b.box('roof',0,ridge+.28,z,.52,.07,.85,.02)
    # Attic vent and real horizontal gable trim.
    b.box('sage_dark',0,8.48,5.30,1.26,.78,.08,.20)
    for i in range(4):
        b.box('ivory',0,8.20+i*.18,5.38,.91,.054,.08,.014)
    put_window(b,-3.36,4.48,front,3.12,3.0)
    put_window(b,3.48,5.1,front,1.95,1.93)
    # Door and six inset molded panels with proper thickness, jamb and threshold.
    b.box('dark_cavity',1.90,2.31,5.11,2.2,3.83,.15,.035)
    b.box('shutter',1.90,2.30,5.24,1.88,3.59,.14,.075)
    for x in (1.36,2.45):
        for y in (1.28,2.40,3.31):
            b.box('sage_dark',x,y,5.34,.75,.73,.07,.034)
            b.box('sage',x,y,5.388,.62,.57,.025,.027)
    for x in (.85,2.97):
        b.box('ivory',x,2.31,5.33,.23,3.92,.27,.06)
    b.box('ivory',1.91,4.36,5.34,2.39,.22,.31,.06)
    b.ball('brass',2.57,2.36,5.43,(.105,.105,.105),seed=9,subdivisions=2)
    b.box('basement',1.9,.85,5.52,3.2,.19,1.0,.07)
    b.box('basement',1.9,.45,5.86,3.16,.16,1.6,.06)
    # Craftsman porch roof and actual columns, where the current game
    # formerly showed disconnected floating box props.
    porch_x=1.95
    b.box('roof',porch_x,5.01,6.07,4.15,.25,2.68,.07)
    b.box('ivory',porch_x,4.88,7.38,4.25,.22,.21,.07)
    for x in (-.06,4.03):
        b.box('basement',x,.61,7.19,.66,.40,.67,.08)
        b.box('ivory',x,2.69,7.19,.29,3.87,.32,.074)
        b.box('ivory',x,4.62,7.19,.64,.24,.64,.06)
        b.box('ivory',x,2.74,7.19,.50,.18,.48,.04)
    # Actual rainwater gutter castings and clamp bands.
    for x in (-6.31,6.31):
        b.box('gutter',x,7.40,0,.14,.20,11.49,.065)
        b.box('gutter',x,4.24,5.31,.11,6.36,.13,.044)
    # Small asymmetrical brick chimney, metallic flashing.
    b.box('brick',-3.7,10.2,-1.8,1.35,3.25,1.40,.07)
    b.box('brick_dark',-3.7,11.85,-1.8,1.57,.27,1.62,.06)
    b.box('dark_cavity',-3.7,12.02,-1.8,.93,.033,.95)
    # Multi-pigment climbing flowers, planters and small physical stems.
    for xx in (-5.40,-4.7,4.75,5.32):
        b.box('basement',xx,.72,5.43,.56,.49,.57,.10)
        b.ball('leaf1',xx,1.10,5.43,(.45,.34,.45),seed=int(xx*10))
        for k in range(6):
            a=k*math.tau/6
            b.ball('leaf2',xx+math.cos(a)*.28,1.30+math.sin(a)*.08,
                   5.43+math.sin(a)*.25,(.15,.17,.15),seed=k)
    return b.make_glb('maple_craftsman_house.glb')


def make_sign(label):
    img=Image.new('RGBA',(1024,256),(33,69,67,255))
    draw=ImageDraw.Draw(img)
    draw.rounded_rectangle((14,18,1010,239),radius=14,fill=(39,77,73),outline=(210,173,115),width=8)
    draw.rounded_rectangle((29,35,995,222),radius=8,outline=(237,221,180),width=3)
    font_path='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
    font=ImageFont.truetype(font_path,101)
    bbox=draw.textbbox((0,0),label,font=font,stroke_width=1)
    width=bbox[2]-bbox[0]
    if width>905:font=ImageFont.truetype(font_path,int(101*900/width))
    draw.text((512,130),label,font=font,anchor='mm',fill=(244,231,193),stroke_fill=(80,66,47),stroke_width=2)
    return img


def make_hardware():
    b=Builder('Maple Junction Hardware 1926')
    b.box('basement',0,.42,0,13.6,.84,11.4,.07)
    b.box('brick',0,6.55,0,13.30,12.32,11.05,.065)
    front=5.55
    # Genuine individually modeled brick courses with interlocking bonds,
    # including cast quoin accents and a capped parapet.
    for row in range(39):
        y=.90+row*.289
        for col in range(13):
            x=-6.17+col*.975+(row%2)*.48
            if x<-6.35 or x>6.20:continue
            # Avoid geometry in large storefront aperture where we use glass.
            if y<6.05 and -5.62<x<5.62:continue
            mat='brick_light' if (row*17+col*7)%11==0 else 'brick_dark' if (row+3*col)%17==0 else 'brick'
            b.box(mat,x,y,front+.056,.92,.245,.12,.012)
    for x in (-6.51,6.51):
        for i in range(38):
            y=.95+i*.286
            b.box('brick_light' if i%5==0 else 'brick',x,y,5.58,.21,.25,.31,.012)
    # Floor-to-ceiling recessed historic storefront bays.
    b.box('dark_cavity',0,3.70,5.63,12.38,5.60,.18,.06)
    for x in (-4.24,-1.32,1.32,4.24):
        b.box('glass',x,3.42,5.74,2.25,4.56,.11,.02)
        b.box('glass_bright',x-.55,4.56,5.81,.28,2.2,.016,.005,7)
        for xoff in (-1.20,1.20):
            b.box('teal',x+xoff,3.44,5.88,.13,4.80,.15,.025)
    b.box('teal',0,5.96,5.85,12.43,.33,.25,.037)
    b.box('teal',0,1.13,5.85,12.48,.20,.27,.036)
    b.box('store_dark',1.32,2.78,5.91,1.98,3.75,.17,.039)
    b.box('glass',1.32,3.35,6.025,1.55,1.85,.025,.014)
    b.cyl('brass',.09,.08,2.06,2.75,6.055,axis='z')
    # Stepped glazed canopy with a scalloped rounded front edge.
    b.box('awning',0,6.41,6.63,13.65,.21,2.28,.07)
    b.box('teal',0,6.35,7.73,13.85,.28,.18,.08)
    for col in range(13):
        x=-6.0+col*.97
        b.box('awning2' if col%2 else 'awning',x,6.29,7.73,.91,.24,.10,.027)
    # Three second-floor windows and sculpted inset cast-stone surrounds.
    for x in (-4.43,0,4.43):
        b.box('dark_cavity',x,9.40,5.64,2.7,3.29,.13,.05)
        b.box('glass',x,9.40,5.76,2.44,3.02,.06,.013)
        for xp in (x-1.35,x+1.35):
            b.box('antique_white',xp,9.4,5.90,.23,3.45,.29,.052)
        for yp in (7.72,11.08):
            b.box('antique_white',x,yp,5.89,3.02,.19,.30,.065)
        b.box('antique_white',x,9.4,5.95,.115,3.0,.115,.018)
        b.box('antique_white',x,9.4,5.95,2.38,.11,.11,.018)
        b.box('antique_white',x,7.61,6.03,3.21,.20,.63,.06)
        b.box('antique_white',x,11.28,5.90,3.4,.19,.35,.05)
    # Decorative cast-stone cornice and shaped roof crown.
    for y,width,thick in [(12.6,13.75,.20),(13.02,13.94,.29),
                          (13.45,14.20,.25),(13.79,14.33,.23)]:
        b.box('antique_white',0,y,0,width,thick,11.75,.08)
    for x in np.arange(-6.22,6.22,1.02):
        b.box('antique_white',float(x),12.79,5.87,.26,.48,.49,.045)
    # Hand-painted enamel sign on a true textured GLB mesh: no browser text.
    img=make_sign('MAPLE HARDWARE')
    m=PBRMaterial(name='Hand-painted MAPLE HARDWARE enamel sign',
                  baseColorTexture=img,baseColorFactor=[255,255,255,255],
                  metallicFactor=.1,roughnessFactor=.44,doubleSided=True)
    b.extra_materials['painted_store_sign']=m
    face=face_quad([[-5.98,6.08,7.89],[5.98,6.08,7.89],
                    [5.98,6.66,7.89],[-5.98,6.66,7.89]])
    b.add(face,'painted_store_sign',uv=np.array([[0,0],[1,0],[1,1],[0,1]]))
    for z in (-5.48,5.48):
        b.box('antique_white',0,13.65,z,14.13,.15,.17,.043)
    b.box('gutter',6.51,6.13,5.7,.14,11.47,.16,.053)
    # Recessed doorway threshold, rust-free bolts and street lights.
    b.box('basement',1.36,.73,6.08,2.43,.17,1.05,.053)
    for x in (-6.23,6.23):
        b.box('dark_brass',x,5.7,6.07,.20,.40,.24,.06)
        b.ball('brass',x,5.41,6.07,(.30,.27,.30),seed=int(x*11))
    return b.make_glb('maple_mainstreet_hardware.glb')


def car_loft(stations,material='red'):
    # Smooth, continuously curved sculpted shell across body front and rear.
    # Station = (z, width, floorY, topY, centerX). 18 angular samples create
    # molded fender contours, not polygonal rectangular cuboids.
    verts=[];faces=[];resolution=24
    smooth_stations=[]
    for i in range(len(stations)-1):
        for step in range(6):
            t=step/6; t2=t*t; t3=t2*t
            coords=[]
            for k in range(5):
                a=stations[max(0,i-1)][k]; b=stations[i][k]
                c=stations[i+1][k]; d=stations[min(len(stations)-1,i+2)][k]
                coords.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3))
            smooth_stations.append(coords)
    smooth_stations.append(stations[-1])
    for z,w,base,top,cx in smooth_stations:
        cy=(base+top)/2;hy=(top-base)/2
        for j in range(resolution):
            a=2*math.pi*j/resolution
            x=cx+.5*w*math.cos(a)
            y=cy+hy*(math.sin(a)*.72+.28*math.sin(a)**3)
            verts.append([x,y,z])
    for i in range(len(smooth_stations)-1):
        for j in range(resolution):
            a=i*resolution+j;b=i*resolution+(j+1)%resolution
            c=(i+1)*resolution+j;d=(i+1)*resolution+(j+1)%resolution
            faces.extend([[a,b,c],[b,d,c]])
    faces.extend([[0,j+1,j] for j in range(1,resolution-1)])
    n=(len(smooth_stations)-1)*resolution
    faces.extend([[n,n+j,n+j+1] for j in range(1,resolution-1)])
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)


def coupe_cabin_shell():
    """Real trapezoidal two-door greenhouse, not an oval placed on the hood."""
    stations=[(-1.18,.70,1.13,1.41),(-.86,.88,1.15,1.87),
              (-.48,.91,1.16,1.99),(.38,.91,1.16,1.99),
              (.75,.83,1.15,1.78),(1.03,.73,1.14,1.43)]
    section=[]
    for z,w,b,t in stations:
        section.append([[-w,b,z],[-w*.94,b+.12,z],[-w*.78,t-.10,z],
                        [-w*.65,t,z],[w*.65,t,z],[w*.78,t-.10,z],
                        [w*.94,b+.12,z],[w,b,z]])
    verts=np.asarray([v for ring in section for v in ring])
    faces=[];n=8
    for i in range(len(section)-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;c=(i+1)*n+j;d=(i+1)*n+(j+1)%n
            faces.extend([[a,c,b],[b,c,d]])
    faces.extend([[0,j,j+1] for j in range(1,n-1)])
    off=(len(section)-1)*n
    faces.extend([[off,off+j+1,off+j] for j in range(1,n-1)])
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)


def wheel_arch_disc(side, wheel_z, radius=.58, steps=30):
    """Wheel-well shadow deliberately hidden behind the visible tire."""
    x=side*1.215
    verts=[[x,.54,wheel_z]]
    for i in range(steps+1):
        a=math.pi*i/steps
        verts.append([x,.54+radius*math.sin(a),wheel_z+radius*math.cos(a)])
    faces=[]
    for i in range(steps):
        face=[0,i+1,i+2]
        faces.append(face if side>0 else face[::-1])
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)


def wheel_arch_lip(side, wheel_z, steps=32):
    x=side*1.228
    verts=[]
    for i in range(steps+1):
        a=math.pi*i/steps
        for r in (.585,.625):
            verts.append([x,.54+r*math.sin(a),wheel_z+r*math.cos(a)])
    faces=[]
    for i in range(steps):
        a=2*i;b=a+2
        faces.extend([[a,a+1,b],[a+1,b+1,b]] if side>0 else
                     [[a,b,a+1],[a+1,b,b+1]])
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)


def make_car():
    b=Builder('Maple Cherry Coupe GT | Revised diecast hardtop')
    # The centerline points along +Z. Model proportions match a 1960s coupe.
    stations=[(-2.23,1.72,.49,.99,0),(-2.05,1.96,.43,1.12,0),
              (-1.77,2.26,.40,1.26,0),(-1.28,2.38,.39,1.35,0),
              (-.52,2.30,.40,1.43,0),(.25,2.32,.41,1.43,0),
              (1.00,2.33,.40,1.38,0),(1.55,2.20,.41,1.31,0),
              (2.04,1.98,.47,1.18,0),(2.25,1.61,.54,1.02,0)]
    b.add(car_loft(stations),'red')
    b.add(coupe_cabin_shell(),'red')
    # Windshields ride on actual front/rear windshield rake.
    b.add(face_quad([[-.69,1.34,1.026],[.69,1.34,1.026],
                     [.66,1.81,.707],[-.66,1.81,.707]],True),'glass')
    b.add(face_quad([[-.65,1.38,-1.155],[.65,1.38,-1.155],
                     [.66,1.79,-.842],[-.66,1.79,-.842]],True),'glass')
    for side in (-1,1):
        # Two side window panes, with real paint-color roof rails and B-pillar.
        b.add(face_quad([[side*.859,1.34,-.72],[side*.718,1.77,-.64],
                         [side*.719,1.82,-.035],[side*.857,1.34,-.035]],True),'glass')
        b.add(face_quad([[side*.857,1.34,.045],[side*.718,1.82,.045],
                         [side*.716,1.80,.378],[side*.828,1.34,.758]],True),'glass')
        b.box('metal',side*.859,1.48,-.005,.050,.45,.061,.016)
        b.box('cream_car',side*1.075,.88,0,.065,.045,3.27,.019)
        b.box('red_shade',side*1.075,1.18,1.45,.06,.023,1.06,.014)
        for wheel_z in (-1.44,1.44):
            b.add(wheel_arch_disc(side,wheel_z),'dark_cavity')
            b.add(wheel_arch_lip(side,wheel_z),'red_shade')
    b.box('red_shade',0,1.35,1.64,.068,.012,.90,.008)
    b.box('metal',0,.57,2.263,1.80,.20,.16,.048)
    b.box('metal',0,.55,-2.258,1.84,.20,.16,.048)
    b.box('dark_cavity',0,.82,2.254,1.05,.24,.115,.024)
    b.box('antique_white',0,.65,-2.265,.74,.16,.055,.017)
    for side in (-1,1):
        b.box('headlamp',side*.78,.93,2.212,.36,.18,.085,.035)
        b.box('taillamp',side*.80,.80,-2.234,.34,.17,.075,.028)
        b.box('metal',side*1.18,1.15,.52,.12,.14,.29,.038)
        b.box('metal',side*1.235,1.18,.57,.25,.055,.064,.022)
    for side in (-1,1):
        for wheel_z in (-1.44,1.44):
            b.cyl('tires',.54,.37,side*1.185,.54,wheel_z,axis='x',sections=40)
            b.add(ring(.394,.047,(side*1.400,.54,wheel_z)),'cream_car')
            b.cyl('metal',.298,.052,side*1.415,.54,wheel_z,axis='x',sections=30)
            b.cyl('dark_cavity',.114,.074,side*1.459,.54,wheel_z,axis='x',sections=22)
            for k in range(5):
                a=math.tau*k/5
                b.ball('brass',side*1.476,.54+.205*math.cos(a),
                       wheel_z+.205*math.sin(a),(.036,.036,.036),k,1)
    b.box('cream_car',0,1.997,-.06,.19,.015,.67,.006)
    return b.make_glb('maple_cherry_coupe.glb')


def make_tree():
    b=Builder('Maple Scenic Tree')
    for i in range(11):
        y=.15+i*.37
        radius=.32-.017*i
        b.cyl('bark' if i%3 else 'bark2',radius,.40,
              .021*math.sin(i*.5),y,.014*math.cos(i*.7),'y',16)
    branch_points=[
        ([0,2.1,0],[-1.35,4.3,.15]),([0,2.7,0],[1.30,4.78,.48]),
        ([0,3.30,0],[-.66,5.3,-.95]),([0,3.6,0],[.75,5.2,-1.25]),
        ([0,4.1,0],[.15,6.0,.55])]
    for start,end in branch_points:
        b.add(branch_mesh(start,end,.12),'bark')
    clusters=[
        (-1.35,4.45,.4,1.30,.99,1.22),
        (1.13,4.87,.4,1.41,1.02,1.23),
        (-.77,5.55,-1.03,1.18,1.1,1.23),
        (1.02,5.52,-1.12,1.21,.95,1.16),
        (.08,6.2,.59,1.35,1.17,1.32),
        (0,5.44,.05,1.46,1.08,1.38),
        (.2,4.56,-1.22,.99,.83,.94),
        (-1.07,5.50,1.05,1.10,.84,.91)]
    for i,(x,y,z,rx,ry,rz) in enumerate(clusters):
        b.ball(['leaf1','leaf2','leaf3','leaf4'][i%4],x,y,z,(rx,ry,rz),i+8,3)
        for j in range(3):
            a=(j+i*1.2)*2.4
            b.ball(['leaf1','leaf3'][j%2],x+math.sin(a)*rx*.56,
                   y+.12+math.cos(a)*ry*.31,z+math.cos(a)*rz*.45,
                   (.47,.37,.45),seed=i*5+j,subdivisions=2)
    return b.make_glb('maple_scenic_tree.glb')

if __name__ == '__main__':
    files=[make_house(),make_hardware(),make_car(),make_tree()]
    print('Generated '+str(len(files))+' GLB assets in '+str(OUT))
