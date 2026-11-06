/**
 * Small optional depth-texture postprocess for the HO photography lab.
 * Focus is measured in view-space distance, not a fixed CSS edge mask.
 * Uses one small fullscreen pass and gracefully stays off on mobile.
 */
export function createHousePhotoPass(THREE,renderer){
  const target=new THREE.WebGLRenderTarget(2,2,{
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false
  });
  target.depthTexture=new THREE.DepthTexture(2,2,THREE.UnsignedShortType);
  target.depthTexture.format=THREE.DepthFormat;
  const vertexShader=[
    'varying vec2 vUv;',
    'void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }'
  ].join('\n');
  const fragmentShader=[
    'varying vec2 vUv;',
    'uniform sampler2D tColor;',
    'uniform sampler2D tDepth;',
    'uniform vec2 texel;',
    'uniform float nearPlane;',
    'uniform float farPlane;',
    'uniform float focalDistance;',
    'uniform float aperture;',
    'uniform float grainAmount;',
    'float viewDepth(float depth){',
    '  return (nearPlane*farPlane)/',
    '    max(.0001,farPlane-depth*(farPlane-nearPlane));',
    '}',
    'float noise(vec2 uv){',
    '  return fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453);',
    '}',
    'void main(){',
    '  float distance=viewDepth(texture2D(tDepth,vUv).r);',
    '  float defocus=clamp(abs(distance-focalDistance)/',
    '    max(1.0,focalDistance)*aperture*8.0,0.0,3.5);',
    '  vec2 radius=texel*defocus;',
    '  vec3 color=texture2D(tColor,vUv).rgb*.28;',
    '  color+=texture2D(tColor,vUv+vec2(radius.x,0.0)).rgb*.09;',
    '  color+=texture2D(tColor,vUv-vec2(radius.x,0.0)).rgb*.09;',
    '  color+=texture2D(tColor,vUv+vec2(0.0,radius.y)).rgb*.09;',
    '  color+=texture2D(tColor,vUv-vec2(0.0,radius.y)).rgb*.09;',
    '  color+=texture2D(tColor,vUv+radius).rgb*.09;',
    '  color+=texture2D(tColor,vUv-radius).rgb*.09;',
    '  color+=texture2D(tColor,vUv+vec2(radius.x,-radius.y)).rgb*.09;',
    '  color+=texture2D(tColor,vUv+vec2(-radius.x,radius.y)).rgb*.09;',
    '  float vignette=smoothstep(.88,.16,length((vUv-.5)*vec2(1.0,.88)));',
    '  color*=mix(.965,1.0,vignette);',
    '  color+=(noise(gl_FragCoord.xy)-.5)*grainAmount;',
    '  gl_FragColor=vec4(max(color,vec3(0.0)),1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');
  const material=new THREE.ShaderMaterial({
    name:'HO tabletop photographic lens',
    depthTest:false,depthWrite:false,
    uniforms:{
      tColor:{value:target.texture},tDepth:{value:target.depthTexture},
      texel:{value:new THREE.Vector2(.5,.5)},
      nearPlane:{value:.1},farPlane:{value:350},
      focalDistance:{value:80},aperture:{value:.60},
      grainAmount:{value:.007}
    },vertexShader,fragmentShader
  });
  const screen=new THREE.Scene();
  const screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  let width=0,height=0;
  function resize(){
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    const w=Math.max(1,Math.floor(size.x));
    const h=Math.max(1,Math.floor(size.y));
    if(w!==width||h!==height){
      width=w;height=h;target.setSize(w,h);
      material.uniforms.texel.value.set(1/w,1/h);
    }
  }
  return {
    render(scene,camera,focusTarget){
      resize();
      const focus=focusTarget.clone().applyMatrix4(camera.matrixWorldInverse);
      material.uniforms.focalDistance.value=Math.max(1,-focus.z);
      material.uniforms.nearPlane.value=camera.near;
      material.uniforms.farPlane.value=camera.far;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene,camera);
      renderer.setRenderTarget(null);
      renderer.render(screen,screenCamera);
    },
    dispose(){
      for(const object of screen.children)object.geometry.dispose();
      material.dispose();target.dispose();
    }
  };
}
