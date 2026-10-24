// v14 world-space sandstone strata. Lighting, shadows, SSAO, fog and probes come from URP's own Lit
// forward helpers; only the albedo is replaced. Shadow, depth and depth-normal passes reuse URP Lit, so
// silhouettes and SRP Batcher layout (LitInput UnityPerMaterial) stay identical to the Lit materials it replaces.
// Repurposed Lit slots: _BaseMap = strata bands (u = horizontal, v = world height), _BaseMap_ST.xy = tiling per
// metre; _DetailAlbedoMap = plateau dust (world XZ), _DetailAlbedoMap_ST.xy = tiling per metre; _SpecColor =
// plateau tint (_SPECULAR_SETUP is never enabled). Mesh UVs are ignored.
Shader "VesperBasin/V14 Strata Rock"
{
 Properties
 {
  [MainTexture] _BaseMap("Strata bands (world height)",2D)="white"{}
  [MainColor] _BaseColor("Wall tint",Color)=(1,1,1,1)
  _SpecColor("Plateau tint",Color)=(1,1,1,1)
  _DetailAlbedoMap("Plateau dust (world XZ)",2D)="grey"{}
  _Smoothness("Smoothness",Range(0,1))=0.12
  _Metallic("Metallic",Range(0,1))=0
  [HideInInspector] _Cutoff("Alpha cutoff",Range(0,1))=0.5
  [HideInInspector] _Surface("__surface",Float)=0
  [HideInInspector] _Cull("__cull",Float)=2
  [HideInInspector] _ZWrite("__zw",Float)=1
  [HideInInspector] _SrcBlend("__src",Float)=1
  [HideInInspector] _DstBlend("__dst",Float)=0
  [HideInInspector] _SrcBlendAlpha("__srcA",Float)=1
  [HideInInspector] _DstBlendAlpha("__dstA",Float)=0
  [HideInInspector] _AlphaToMask("__alphaToMask",Float)=0
  [HideInInspector] _AlphaClip("__clip",Float)=0
  [HideInInspector] _ReceiveShadows("Receive shadows",Float)=1
  [HideInInspector] _BumpScale("Scale",Float)=1
  [HideInInspector] _OcclusionStrength("Occlusion",Float)=1
  [HideInInspector] _EmissionColor("Emission",Color)=(0,0,0,1)
  [HideInInspector] _DetailAlbedoMapScale("Detail scale",Float)=1
  [HideInInspector] _DetailNormalMapScale("Detail normal scale",Float)=1
  [HideInInspector] _Parallax("Parallax",Float)=0.005
  [HideInInspector] _ClearCoatMask("Clear coat",Float)=0
  [HideInInspector] _ClearCoatSmoothness("Clear coat smoothness",Float)=0
 }
 SubShader
 {
  Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "UniversalMaterialType"="Lit" "IgnoreProjector"="True" }
  LOD 300
  Pass
  {
   Name "ForwardLit"
   Tags { "LightMode"="UniversalForward" }
   ZWrite On
   Cull Back
   HLSLPROGRAM
   #pragma target 2.0
   #pragma vertex LitPassVertex
   #pragma fragment StrataFragment
#if defined(UNITY_PLATFORM_META_QUEST)
   #pragma multi_compile _ META_QUEST_LIGHTUNROLL
#endif
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #pragma multi_compile _ EVALUATE_SH_MIXED EVALUATE_SH_VERTEX
   #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
   #pragma multi_compile_fragment _ _REFLECTION_PROBE_BLENDING
   #pragma multi_compile_fragment _ _REFLECTION_PROBE_BOX_PROJECTION
   #pragma multi_compile_fragment _ _REFLECTION_PROBE_ATLAS
   #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
   #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
   #pragma multi_compile_fragment _ _LIGHT_COOKIES
   #pragma multi_compile _ _LIGHT_LAYERS
   #pragma multi_compile _ _CLUSTER_LIGHT_LOOP
#if defined(UNITY_PLATFORM_META_QUEST)
   #pragma multi_compile _ META_QUEST_NO_SPOTLIGHTS_LIGHT_LOOP
#endif
   #include_with_pragmas "Packages/com.unity.render-pipelines.core/ShaderLibrary/FoveatedRenderingKeywords.hlsl"
   #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/RenderingLayers.hlsl"
   #pragma multi_compile _ LIGHTMAP_SHADOW_MIXING
   #pragma multi_compile _ SHADOWS_SHADOWMASK
   #pragma multi_compile _ LIGHTMAP_ON
   #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Fog.hlsl"
   #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/ProbeVolumeVariants.hlsl"
   #pragma multi_compile_instancing
   #pragma instancing_options renderinglayer
   #include_with_pragmas "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DOTS.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/Shaders/LitInput.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/Shaders/LitForwardPass.hlsl"

   half3 StrataAlbedo(float3 p, half3 n)
   {
    // Gentle long-wavelength warp keeps beds continuous across separate meshes without ruler-straight lines.
    float warp = sin(p.x * 0.031 + p.z * 0.017) * 1.6 + sin(p.z * 0.047 - p.x * 0.012) * 0.9;
    float v = (p.y + warp) * _BaseMap_ST.y + _BaseMap_ST.w;
    half3 alongZ = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, float2(p.z * _BaseMap_ST.x, v)).rgb;
    half3 alongX = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, float2(p.x * _BaseMap_ST.x + 0.37, v)).rgb;
    half wx = abs(n.x), wz = abs(n.z);
    half3 wall = (alongZ * wx + alongX * wz) / max(wx + wz, 0.001h);
    half3 dust = SAMPLE_TEXTURE2D(_DetailAlbedoMap, sampler_DetailAlbedoMap, p.xz * _DetailAlbedoMap_ST.xy).rgb;
    half plateau = smoothstep(0.55h, 0.85h, n.y);
    return lerp(wall * _BaseColor.rgb, dust * _SpecColor.rgb, plateau);
   }

   void StrataFragment(Varyings input, out half4 outColor : SV_Target0
#ifdef _WRITE_RENDERING_LAYERS
    , out uint outRenderingLayers : SV_Target1
#endif
   )
   {
    UNITY_SETUP_INSTANCE_ID(input);
    UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);
    SurfaceData surfaceData;
    InitializeStandardLitSurfaceData(input.uv, surfaceData);
    InputData inputData;
    InitializeInputData(input, surfaceData.normalTS, inputData);
    surfaceData.albedo = StrataAlbedo(input.positionWS, inputData.normalWS);
    surfaceData.alpha = 1;
    InitializeBakedGIData(input, inputData);
    half4 color = UniversalFragmentPBR(inputData, surfaceData);
    color.rgb = MixFog(color.rgb, inputData.fogCoord);
    color.a = 1;
    outColor = color;
#ifdef _WRITE_RENDERING_LAYERS
    outRenderingLayers = EncodeMeshRenderingLayer();
#endif
   }
   ENDHLSL
  }
  UsePass "Universal Render Pipeline/Lit/SHADOWCASTER"
  UsePass "Universal Render Pipeline/Lit/DEPTHONLY"
  UsePass "Universal Render Pipeline/Lit/DEPTHNORMALS"
 }
 FallBack "Hidden/Universal Render Pipeline/FallbackError"
}
