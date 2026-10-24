// v17 world-space industrial deck for the road/pad network (structure of VesperV14StrataRock: URP Lit forward helpers
// with only the albedo replaced; ShadowCaster/DepthOnly/DepthNormals reuse URP Lit, so the LitInput UnityPerMaterial
// layout and silhouettes are unchanged). Repurposed Lit slots: _BaseMap = 16 m deck tile (running-bond slabs, joints,
// hatches, grates) sampled with world XZ on decks and world X|Z,Y on kerb faces, _BaseMap_ST.xy = tiling per metre;
// _DetailAlbedoMap = large-scale wear (rgb oil/grime multiplier, a = sand-drift coverage), _DetailAlbedoMap_ST.xy = tiling
// per metre; _SpecColor = drift strength (r) and kerb-face shade (g); _EmissionColor = drift sand colour (_EMISSION is
// never enabled, so URP does not emit it). Mesh UVs are ignored, so static batching cannot change the pattern.
Shader "VesperBasin/V17 Industrial Deck"
{
 Properties
 {
  [MainTexture] _BaseMap("Deck tile (world XZ)",2D)="white"{}
  [MainColor] _BaseColor("Deck tint",Color)=(1,1,1,1)
  _SpecColor("Drift strength (r), kerb shade (g)",Color)=(1,0.8,0,1)
  _DetailAlbedoMap("Wear (world XZ)",2D)="grey"{}
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
  _EmissionColor("Drift sand colour",Color)=(0.3,0.2,0.12,1)
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
   #pragma fragment DeckFragment
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

   half3 DeckAlbedo(float3 p, half3 n)
   {
    half3 deck = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, p.xz * _BaseMap_ST.xy + _BaseMap_ST.zw).rgb;
    half4 wear4 = SAMPLE_TEXTURE2D(_DetailAlbedoMap, sampler_DetailAlbedoMap, p.xz * _DetailAlbedoMap_ST.xy);
    // Sand drift is an absolute blend toward the dust colour so it reads on the dark deck from overview distance.
    half3 top = lerp(deck * wear4.rgb * _BaseColor.rgb, _EmissionColor.rgb, wear4.a * _SpecColor.r);
    // Kerb and pad faces: same slab tile run along the face, slightly shaded so deck edges read.
    half wx = abs(n.x), wz = abs(n.z);
    half3 alongZ = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, float2(p.z, p.y) * _BaseMap_ST.xy).rgb;
    half3 alongX = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, float2(p.x, p.y) * _BaseMap_ST.xy).rgb;
    half3 side = (alongZ * wx + alongX * wz) / max(wx + wz, 0.001h) * _SpecColor.g * _BaseColor.rgb;
    half deckWeight = smoothstep(0.45h, 0.75h, abs(n.y));
    return lerp(side, top, deckWeight);
   }

   void DeckFragment(Varyings input, out half4 outColor : SV_Target0
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
    surfaceData.albedo = DeckAlbedo(input.positionWS, inputData.normalWS);
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
