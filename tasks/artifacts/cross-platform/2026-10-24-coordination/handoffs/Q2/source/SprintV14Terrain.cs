#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace VesperBasin.Editor
{
    /// <summary>v14 copy of SprintV13Terrain: same placements and crops; flat stepped buttress tops and planar tilted
    /// broken caps replace the pointed/folded fans; strata materials. Writes only to SprintAssets/v14.</summary>
    public static class SprintV14Terrain
    {
        public const string ChildName = "Terrain";
        public const float RadarTop = 13.7f;
        public const float ArtilleryTop = 26.6f;
        private const int Sides = 40, MaterialCount = 6;

        [Serializable] public sealed class Receipt
        {
            public string owner = "SprintV14Terrain";
            public int localFormInstances, nearFormInstances, farFormInstances;
            public int localTriangles, nearTriangles, farTriangles;
            public int renderers = 4, colliders = 3, materials = MaterialCount, textures = 2;
            public float radarTop = RadarTop, artilleryTop = ArtilleryTop;
            public string note = "v14 regeneration of the v13 additive terrain with stepped flat-topped buttresses and planar broken caps. Keep v12 playable islands, basin and water. Hide old near/far backdrop renderers and disable old near collider in v13 only. All new collision uses the visible mesh; distant ridges have no collision. No headset performance claim.";
        }
        public static void Build(Transform root, string assetFolder, Material[] mats)
        {
            if(root == null) throw new ArgumentNullException(nameof(root));
            assetFolder=assetFolder.TrimEnd('/');
            if(assetFolder!="Assets/MapPrototype/SprintAssets/v14" && !assetFolder.StartsWith("Assets/MapPrototype/SprintAssets/v14/",StringComparison.Ordinal))
                throw new ArgumentException("Use the dedicated v14 asset folder",nameof(assetFolder));
            if(mats==null||mats.Length!=MaterialCount)throw new ArgumentException("Six terrain materials required",nameof(mats));
            string folder=assetFolder+"/Terrain";
            Directory.CreateDirectory(folder);AssetDatabase.Refresh();
            var old=root.Find(ChildName);if(old!=null)UnityEngine.Object.DestroyImmediate(old.gameObject);
            var terrain=new GameObject(ChildName).transform;terrain.SetParent(root,false);
            // Reuse four ring profiles at all scales. Each instance can crop its apron away from a route.
            var templates=new Mesh[4];
            for(int i=0;i<4;i++)templates[i]=Save(folder,"Reusable broken terrace "+i,Rock(i,false));
            var localTemplates=new Mesh[4];
            for(int i=0;i<4;i++)localTemplates[i]=Save(folder,"Reusable fractured local rock "+i,Rock(i,true));
            var spurs=new Mesh[2];
            for(int i=0;i<2;i++)spurs[i]=Save(folder,"Reusable stepped buttress "+i,Spur(i));
            var local=new Data();var summit=new Data();var near=new Data();var far=new Data();
            var receipt=new Receipt();
            // Southern crop applies to EVERY vertex, including submerged feet. No hidden solid across the ascent.
            Add(local,localTemplates,0,new Vector3(-2,-27,76.5f),new Vector3(32,40.7f,25),0,2,65);
            Add(local,localTemplates,1,new Vector3(-16,-27,78),new Vector3(17,31,25),-14,2,65);
            Add(local,localTemplates,2,new Vector3(12,-27,80),new Vector3(17,33,24),11,2,65);
            Add(local,localTemplates,3,new Vector3(-2,-27,89),new Vector3(33,29,20),4,2,65);
            // Canyon throat: crop even the widest foot away from the 8 m route and the existing bridge.
            Add(local,localTemplates,2,new Vector3(-34,-27,27),new Vector3(13,35.5f,22),-13,1,-26,true);
            Add(local,localTemplates,1,new Vector3(8,-27,36),new Vector3(13,39,18),17,0,0,true);
            receipt.localFormInstances=6;
            // Scenic high artillery shoulder: plateau top is beneath the structure base, not a new route.
            Add(summit,localTemplates,3,new Vector3(0,-28,126),new Vector3(44,54.6f,38),0,2,96);
            Add(summit,localTemplates,0,new Vector3(-21,-28,128),new Vector3(28,43,37),-18,2,96);
            Add(summit,localTemplates,1,new Vector3(22,-28,130),new Vector3(28,39,34),19,2,96);
            Add(summit,localTemplates,2,new Vector3(0,-28,145),new Vector3(45,36,29),-5,2,96);
            receipt.localFormInstances+=4;
            // Large bedrock fracture spurs, integrated into the front masses rather than scattered rubble.
            Add(local,spurs,0,new Vector3(-29,-27,28),new Vector3(9,34,18),-21,1,-26);
            Add(local,spurs,1,new Vector3(3,-27,35),new Vector3(8,36,15),16,0,0);
            Add(local,spurs,0,new Vector3(-14,-27,70),new Vector3(12,37,17),-18,2,65);
            Add(local,spurs,1,new Vector3(10,-27,73),new Vector3(11,34,15),22,2,65);
            Add(summit,spurs,0,new Vector3(-19,-28,111),new Vector3(17,46,24),-16,2,96);
            Add(summit,spurs,1,new Vector3(16,-28,109),new Vector3(15,42,22),19,2,96);
            Add(summit,spurs,0,new Vector3(-3,-28,105),new Vector3(11,35,17),-8,2,96);
            receipt.localFormInstances+=7;
            // Low terraced ranges open sky. Their near edges remain outside all saved outpost roads.
            float[] northX={-184,-105,-32,49,135,210};
            float[] northHeight={51,44,47,39,49,45};
            for(int i=0;i<northX.Length;i++)
            {
                Add(near,templates,i%4,new Vector3(northX[i],-28,200+(i%2)*10),new Vector3(102+(i%3)*9,northHeight[i],65),5*Mathf.Sin(i*1.9f),2,162,true);
                Add(near,templates,(i+2)%4,new Vector3(northX[i],-28,-155-(i%2)*9),new Vector3(105+(i%2)*14,45+(i%3)*6,60),-7*Mathf.Sin(i),3,-111,true);
                receipt.nearFormInstances+=2;
            }
            for(int i=0;i<4;i++)foreach(float side in new[]{-1f,1f})
            {
                Add(near,templates,(i+1)%4,new Vector3(side*(198+(i%2)*11),-28,-95+i*79),new Vector3(63,47+(i%3)*7,108),7*Mathf.Sin(i+side),side>0?0:1,side*143,true);
                receipt.nearFormInstances++;
            }
            for(int i=0;i<4;i++)foreach(float side in new[]{-1f,1f})
            {
                Add(far,templates,(i+3)%4,new Vector3(-228+i*151,-29,side*(298+(i%2)*15)),new Vector3(176,48+(i%3)*11,98),6*Mathf.Sin(i+side),-1,0,true);
                receipt.farFormInstances++;
            }
            for(int i=0;i<3;i++)foreach(float side in new[]{-1f,1f})
            {
                Add(far,templates,(i+2)%4,new Vector3(side*337,-29,-174+i*186),new Vector3(105,50+(i%2)*15,203),7*Mathf.Sin(i*2+side),-1,0,true);
                receipt.farFormInstances++;
            }
            Place(terrain,folder,"Radar plateau and route shoulders",local,mats,true);
            Place(terrain,folder,"High artillery plateau",summit,mats,true);
            Place(terrain,folder,"Lower terraced boundary ridges",near,mats,true);
            Place(terrain,folder,"Distant open skyline",far,mats,false);
            receipt.localTriangles=local.TriangleCount+summit.TriangleCount;
            receipt.nearTriangles=near.TriangleCount;receipt.farTriangles=far.TriangleCount;
            File.WriteAllText(folder+"/Terrain-build-report.json",JsonUtility.ToJson(receipt,true));
            AssetDatabase.SaveAssets();Debug.Log("VESPER_V14_TERRAIN "+JsonUtility.ToJson(receipt));
        }
        // Crop values: 0=minX, 1=maxX, 2=minZ, 3=maxZ. Cropping retains a closed visible mesh.
        private static void Add(Data target,Mesh[] templates,int variant,Vector3 position,Vector3 scale,float yaw,int crop,float limit,bool brokenCap=false)
        {
            target.Append(templates[variant%templates.Length],Matrix4x4.TRS(position,Quaternion.Euler(0,yaw,0),scale),crop,limit,brokenCap,variant,scale.y);
        }
        private static Mesh Rock(int variant,bool fractured)
        {
            var data=new Data();
            float[] levels=fractured?new[]{0f,.15f,.24f,.26f,.45f,.48f,.69f,.73f,.84f,.87f,.94f,1f}:new[]{0f,.15f,.24f,.26f,.45f,.48f,.69f,.73f,1f};
            float[] radii=fractured?new[]{1.85f,1.64f,1.53f,1.32f,1.26f,1.15f,1.13f,1.10f,1.075f,1.025f,1.015f,1f}:new[]{1.85f,1.64f,1.53f,1.32f,1.26f,1.12f,1.08f,1.015f,1f};
            var ring=new Vector3[levels.Length,Sides];
            for(int l=0;l<levels.Length;l++)for(int i=0;i<Sides;i++)
            {
                float a=i*Mathf.PI*2/Sides,t=levels[l];
                float outline=1+.065f*Mathf.Sin(a*3+variant*.8f)+.045f*Mathf.Cos(a*5+variant*1.3f);
                // Erosion concentrates on a few faces. Ledges dissolve into ramps around other azimuths.
                float ledgeWeight=.30f+.70f*Mathf.Pow(.5f+.5f*Mathf.Sin(a*2+variant),2);
                float smoothRadius=Mathf.Lerp(1.85f,1,t);
                float radius=Mathf.Lerp(smoothRadius,radii[l],ledgeWeight);
                float incise=.055f*Mathf.Pow(Mathf.Max(0,Mathf.Cos(a*4+variant*.71f)),8)*Mathf.Sin(t*Mathf.PI);
                radius=(radius-incise)*outline;
                float y=t;
                if(l>0 && l<levels.Length-1)y+=.012f*Mathf.Sin(a*3+variant+l*.22f)*Mathf.Sin(t*Mathf.PI);
                // Slightly off-center strata create asymmetry without an overhanging vase silhouette.
                float dx=.035f*(1-t)*Mathf.Sin(variant+1),dz=.025f*(1-t)*Mathf.Cos(variant+2);
                Vector3 point=new Vector3(Mathf.Sin(a)*radius*.5f+dx,y,Mathf.Cos(a)*radius*.5f+dz);
                if(fractured && l>0 && l<levels.Length-1)
                {
                    // Ten large fracture planes replace the circular section; original cap is unchanged.
                    int sector=i/4;float u=(i%4)/4f;
                    Vector3 edge=Vector3.Lerp(FractureCorner(sector,variant),FractureCorner((sector+1)%10,variant),u);
                    float envelope=Mathf.Min(1,t*6)*Mathf.Min(1,(1-t)*16);
                    Vector3 planar=edge*(radius/outline);
                    point.x=Mathf.Lerp(point.x,planar.x+dx,envelope*.92f);
                    point.z=Mathf.Lerp(point.z,planar.z+dz,envelope*.92f);
                    // Keep the upper cap supported: fracture cuts must not create an all-around top overhang.
                    float footprint=.5f*outline;
                    float horizontal=Mathf.Sqrt(point.x*point.x+point.z*point.z);
                    if(horizontal<footprint){point.x*=footprint/horizontal;point.z*=footprint/horizontal;}
                    // Sediment planes tilt and terminate: no shared horizontal belt circling each form.
                    point.y+=envelope*(.027f*Mathf.Sin(a+variant*.8f)+.018f*Mathf.Sin(a*3+variant+l*.44f));
                }
                ring[l,i]=point;
            }
            for(int l=0;l<levels.Length-1;l++)
            {
                if(fractured)
                {
                    for(int i=0;i<Sides;i++)
                    {
                        int j=(i+1)%Sides;
                        float patch=Mathf.Sin(i*.29f+variant*1.1f+l*.7f);
                        bool ledge=(l==2||l==4||l==8);
                        int m=l==0?0:(ledge && patch>.1f?3:(patch<-.6f?1:2));
                        Vector3 n=ring[l,i]+ring[l,j];n.y=0;
                        data.Triangle(ring[l,i],ring[l+1,i],ring[l+1,j],m,n);
                        data.Triangle(ring[l,i],ring[l+1,j],ring[l,j],m,n);
                    }
                }
                else
                {
                    int start=data.VertexCount;
                    for(int i=0;i<=Sides;i++)
                    {
                        data.Vertex(ring[l,i%Sides],new Vector2(i*3f/Sides,levels[l]*4));
                        data.Vertex(ring[l+1,i%Sides],new Vector2(i*3f/Sides,levels[l+1]*4));
                    }
                    for(int i=0;i<Sides;i++)
                    {
                        int m=(l==2||l==4||l==6)?3:2;
                        float patch=Mathf.Sin(i*.29f+variant*1.1f+l*.7f);
                        if(l==0)m=0;else if(patch<-.55f)m=1;else if(l==3 && patch>.45f)m=4;
                        int a=start+i*2,b=a+1,c=a+3,d=a+2;
                        data.Indices(a,c,b,m);data.Indices(a,d,c,m);
                    }
                }
            }
            for(int i=0;i<Sides;i++)
            {
                int j=(i+1)%Sides;
                data.Triangle(Vector3.up,ring[levels.Length-1,i],ring[levels.Length-1,j],5,Vector3.up);
                data.Triangle(Vector3.zero,ring[0,j],ring[0,i],0,Vector3.down);
            }
            return data.ToMesh((fractured?"Reusable fractured local rock ":"Reusable broken terrace ")+variant);
        }
        private static Vector3 FractureCorner(int index,int variant)
        {
            float a=index*Mathf.PI*2/10;
            float original=1+.065f*Mathf.Sin(a*3+variant*.8f)+.045f*Mathf.Cos(a*5+variant*1.3f);
            float[] fracture={1.04f,.91f,1.13f,1.02f,.93f,1.10f,.98f,1.07f,.90f,1.05f};
            float r=.5f*original*fracture[(index+variant*2)%10];
            return new Vector3(Mathf.Sin(a)*r,0,Mathf.Cos(a)*r);
        }
        private static Mesh Spur(int variant)
        {
            var data=new Data();
            var outline=new[]{new Vector2(-.5f,-.35f),new Vector2(-.2f,-.5f),new Vector2(.3f,-.48f),new Vector2(.5f,-.15f),
                new Vector2(.4f,.4f),new Vector2(.05f,.5f),new Vector2(-.4f,.33f),new Vector2(-.53f,0)};
            // v14: two inset ledges and a flat, gently tilted top. The base ring is unchanged from v13, every upper
            // ring stays inside it, and the top (.90) stays below the v13 apex (.96), so crops and route margins hold.
            float[] scales={1f,.84f,.76f,.66f,.58f};
            float[] heights={0f,.40f,.43f,.84f,.87f};
            var ring=new Vector3[scales.Length,8];
            for(int l=0;l<scales.Length;l++)for(int i=0;i<8;i++)
            {
                Vector2 v=outline[(i+variant*2)%8];float s=scales[l];
                float y=heights[l]+(l==0?0:.018f*(v.x*Mathf.Cos(variant)+v.y*Mathf.Sin(variant)));
                ring[l,i]=new Vector3(v.x*s+l*.02f,y,v.y*s+l*.05f);
            }
            for(int l=0;l<scales.Length-1;l++)for(int i=0;i<8;i++)
            {
                int j=(i+1)%8;Vector3 n=ring[l,i]+ring[l,j];n.y=0;
                bool ledge=l==1||l==3;int m=ledge?3:(i%3==0?1:2);
                if(ledge)n=Vector3.up;
                data.Triangle(ring[l,i],ring[l+1,i],ring[l+1,j],m,n);
                data.Triangle(ring[l,i],ring[l+1,j],ring[l,j],m,n);
            }
            int top=scales.Length-1;Vector3 centre=Vector3.zero;
            for(int i=0;i<8;i++)centre+=ring[top,i]/8f;
            for(int i=0;i<8;i++)
            {
                int j=(i+1)%8;
                data.Triangle(centre,ring[top,i],ring[top,j],5,Vector3.up);
                data.Triangle(Vector3.zero,ring[0,j],ring[0,i],0,Vector3.down);
            }
            return data.ToMesh("Reusable stepped buttress "+variant);
        }
        private static void Place(Transform parent,string folder,string name,Data data,Material[] mats,bool collision)
        {
            var mesh=Save(folder,name,data.ToMesh(name));
            var go=new GameObject(name);go.transform.SetParent(parent,false);go.isStatic=true;
            go.AddComponent<MeshFilter>().sharedMesh=mesh;
            var r=go.AddComponent<MeshRenderer>();r.sharedMaterials=mats;
            r.shadowCastingMode=collision?ShadowCastingMode.On:ShadowCastingMode.Off;r.receiveShadows=true;
            if(collision)go.AddComponent<MeshCollider>().sharedMesh=mesh;
        }
        private static Mesh Save(string folder,string name,Mesh source)
        {
            string path=folder+"/"+name+".asset";var old=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(old==null){AssetDatabase.CreateAsset(source,path);return source;}
            EditorUtility.CopySerialized(source,old);UnityEngine.Object.DestroyImmediate(source);EditorUtility.SetDirty(old);return old;
        }
        private sealed class Data
        {
            readonly List<Vector3> vertices=new List<Vector3>();readonly List<Vector2> uvs=new List<Vector2>();
            readonly List<int>[] triangles=new List<int>[MaterialCount];
            public int VertexCount=>vertices.Count;
            public int TriangleCount {get {int n=0;foreach(var t in triangles)n+=t.Count/3;return n;}}
            public Data(){for(int i=0;i<MaterialCount;i++)triangles[i]=new List<int>();}
            public void Vertex(Vector3 v,Vector2 uv){vertices.Add(v);uvs.Add(uv);}
            public void Indices(int a,int b,int c,int mat){triangles[mat].Add(a);triangles[mat].Add(b);triangles[mat].Add(c);}
            public void Triangle(Vector3 a,Vector3 b,Vector3 c,int mat,Vector3 normal)
            {
                int s=VertexCount;Vertex(a,new Vector2(a.x,a.z));Vertex(b,new Vector2(b.x,b.z));Vertex(c,new Vector2(c.x,c.z));
                if(Vector3.Dot(Vector3.Cross(b-a,c-a),normal)>=0)Indices(s,s+1,s+2,mat);else Indices(s,s+2,s+1,mat);
            }
            public void Append(Mesh source,Matrix4x4 tx,int crop,float limit,bool brokenCap,int variant,float height)
            {
                int offset=VertexCount;var vs=source.vertices;var uv=source.uv;var ns=source.normals;
                for(int i=0;i<vs.Length;i++)
                {
                    var p=tx.MultiplyPoint3x4(vs[i]);
                    if(brokenCap)
                    {
                        // v14: a planar tilt keeps every top-ring vertex and the cap centre coplanar (a slanted
                        // mesa top), replacing the v13 azimuth sinusoid that folded the cap fan into tent ridges.
                        float t=vs[i].y,tilt=.09f*vs[i].x*Mathf.Cos(variant*1.3f)+.07f*vs[i].z*Mathf.Sin(variant*1.3f+.6f);
                        p.y+=height*t*t*t*tilt;
                    }
                    if(crop==0)p.x=Mathf.Max(p.x,limit);else if(crop==1)p.x=Mathf.Min(p.x,limit);
                    else if(crop==2)
                    {
                        // Radar front recedes with height instead of becoming a straight crop wall.
                        float setback=limit==65f?3f*vs[i].y*vs[i].y:0;
                        p.z=Mathf.Max(p.z,limit+setback);
                    }
                    else if(crop==3)p.z=Mathf.Min(p.z,limit);
                    Vertex(p,ns[i].y>.99f?new Vector2(p.x,p.z)*.13f:uv[i]);
                }
                for(int m=0;m<MaterialCount;m++)foreach(int v in source.GetTriangles(m))triangles[m].Add(v+offset);
            }
            public Mesh ToMesh(string name)
            {
                var mesh=new Mesh{name=name,indexFormat=VertexCount>65535?IndexFormat.UInt32:IndexFormat.UInt16};
                mesh.SetVertices(vertices);mesh.SetUVs(0,uvs);mesh.subMeshCount=MaterialCount;
                for(int m=0;m<MaterialCount;m++)mesh.SetTriangles(triangles[m],m,false);
                mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
            }
        }
    }
}
#endif
