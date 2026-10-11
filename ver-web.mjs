import { crearPanel } from './src/panel.js';
const M=(c,p,pr,con)=>({canal:c,plan:p,propio:pr,cfg:{},chat:{conectado:con},brain:{modo:'llm',cfg:{mode:'llm',enabled:true,replyChance:0.6}},totalJuegos:17,aplicarAjustes(){return{ok:true};}});
crearPanel({config:{panel:{enabled:true,port:18099}},mundos:[M('jonasrdb','full',true,true),M('kokodeejay','full',false,false)],RAIZ:'.',cerrar:()=>{}}).iniciar();
setInterval(()=>{},60000);
