import React from 'react';
export type AppMode = 'quicksolve'|'deeplearn';
interface Props{onSelect:(mode:AppMode)=>void;}
const Y='#F5B800';const B='#0A0A0A';const W='#FFFFFF';
const modes=[
  {id:'quicksolve' as AppMode,icon:'⚡',iconBg:'linear-gradient(135deg,#1e3a5f,#0d2137)',iconColor:'#60a5fa',borderColor:'#1e4976',borderHover:'#60a5fa',glowColor:'rgba(96,165,250,0.12)',name:'QuickSolve',tagline:'Solve your doubts instantly',taglineColor:'#60a5fa',description:'Saraswati gives you sharp, fast answers with step-by-step solutions and quick MCQs.',buttonText:'Start QuickSolve →',buttonBg:'#60a5fa',buttonColor:B,features:['⚡ Fast, direct answers','📝 Quick MCQ practice','🔬 Clear step-by-step Science']},
  {id:'deeplearn' as AppMode,icon:'🏛️',iconBg:'linear-gradient(135deg,#3a2800,#1f1500)',iconColor:Y,borderColor:'#3a2800',borderHover:Y,glowColor:'rgba(245,184,0,0.10)',name:'DeepLearn',tagline:'Learn like a real classroom',taglineColor:Y,description:'Saraswati teaches with voice, energy, and curiosity — making you truly understand, not just memorise.',buttonText:'Start DeepLearn →',buttonBg:Y,buttonColor:B,features:['🎙️ Teacher voice & audio','🧠 Deep concept building','✨ Interactive & energetic']},
];
export default function ModeSelect({onSelect}:Props){
  const [hovered,setHovered]=React.useState<AppMode|null>(null);
  return(
    <div style={{minHeight:'100vh',background:B,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Segoe UI',system-ui,sans-serif",padding:'1.25rem',boxSizing:'border-box'}}>
      <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(245,184,0,0.1)',border:'2px solid rgba(245,184,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 0.75rem',fontSize:'2rem',fontWeight:'bold',color:Y,fontFamily:'Arial'}}>स</div>
        <h1 style={{color:W,fontSize:'1.5rem',fontWeight:700,margin:'0 0 0.25rem'}}>Saraswati</h1>
        <p style={{color:Y,fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 0.5rem'}}>CBSE Science · Marathi · UttarAI</p>
        <p style={{color:'#444',fontSize:'0.72rem',letterSpacing:'0.06em',textTransform:'uppercase'}}>Choose your learning mode</p>
      </div>
      <div style={{display:'flex',gap:'1.25rem',flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:800}}>
        {modes.map(m=>(
          <div key={m.id} onMouseEnter={()=>setHovered(m.id)} onMouseLeave={()=>setHovered(null)}
            style={{background:hovered===m.id?'#161616':'#111',border:`1.5px solid ${hovered===m.id?m.borderHover:m.borderColor}`,borderRadius:18,padding:'1.5rem',flex:'1 1 280px',maxWidth:360,minWidth:260,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',transition:'all 0.25s ease',cursor:'default',boxShadow:hovered===m.id?`0 0 35px ${m.glowColor}`:'none',boxSizing:'border-box'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:m.iconBg,border:`2px solid ${hovered===m.id?m.iconColor:m.borderColor}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.9rem',marginBottom:'1rem'}}>{m.icon}</div>
            <div style={{color:W,fontWeight:700,fontSize:'1.2rem',marginBottom:'0.3rem'}}>{m.name}</div>
            <div style={{color:m.taglineColor,fontWeight:600,fontSize:'0.78rem',marginBottom:'0.85rem'}}>{m.tagline}</div>
            <div style={{width:'100%',height:1,background:'#1e1e1e',marginBottom:'0.85rem'}}/>
            <p style={{color:'#5a6474',fontSize:'0.8rem',lineHeight:1.6,marginBottom:'1rem'}}>{m.description}</p>
            <div style={{display:'flex',flexDirection:'column',gap:'0.35rem',width:'100%',marginBottom:'1.25rem'}}>
              {m.features.map((f,i)=><div key={i} style={{background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:7,padding:'0.4rem 0.7rem',color:'#6b7280',fontSize:'0.75rem',textAlign:'left'}}>{f}</div>)}
            </div>
            <button onClick={()=>onSelect(m.id)} style={{width:'100%',padding:'0.8rem',background:m.buttonBg,border:'none',borderRadius:11,color:m.buttonColor,fontWeight:700,fontSize:'0.9rem',cursor:'pointer',transform:hovered===m.id?'scale(1.02)':'scale(1)',transition:'transform 0.15s'}}>{m.buttonText}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
