// Cerebro en modo LOCAL: respuestas por reglas, sin internet y sin coste.
// No es una IA: es un motor de intenciones con memoria del contexto.
// La gracia esta en la variedad de respuestas y en los temas del canal.

import { sinTildes } from '../moderation.js';

const AZAR = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------
//  PLANTILLAS POR INTENCION
//  {usuario} se sustituye por el nombre de quien escribe.
// ---------------------------------------------------------------
const INTENCIONES = [
  {
    id: 'saludo',
    prueba: (t) => /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|epa|que pasa|que tal|saludos|holaa+|holi)\b/.test(t),
    respuestas: [
      '¡Buenas {usuario}! 🎧',
      '¡Hola {usuario}! Ponte cómodo que esto acaba de empezar',
      '¡Epa {usuario}! ¿Como va la noche?',
      '¡Buenas! Bienvenido al set, {usuario} 🎶',
    ],
  },
  {
    id: 'saludo_bot',
    prueba: (t, ctx) => ctx.mencionaBot && /(hola|buenas|hey|epa|que tal)/.test(t),
    respuestas: [
      '¡Hola {usuario}! Aquí ando, vigilando el chat 👀',
      '¡Buenas {usuario}! ¿Que tal va?',
      '¡Epa! Aquí estoy para lo que necesites 🎧',
    ],
  },
  {
    id: 'despedida',
    prueba: (t) => /(adiós|chao|chau|me voy|me piro|hasta luego|buenas noches a todos|nos vemos)/.test(t),
    respuestas: [
      '¡Hasta luego {usuario}! Gracias por pasarte 💜',
      'Nos vemos {usuario}, cuidado al salir 🎧',
      '¡Un placer {usuario}! Aquí seguimos con el set',
    ],
  },
  {
    id: 'gracias',
    prueba: (t) => /(gracias|thanks|thank you|grax|graciass)/.test(t),
    respuestas: [
      '¡A ti {usuario}! 💜',
      'De nada {usuario}, para eso estamos 🎧',
      '¡Gracias a ti por estar ahí!',
    ],
  },
  {
    id: 'pregunta_bot',
    prueba: (t) => /(eres un bot|eres una ia|eres humano|eres real|quien eres|que eres|eres persona)/.test(t),
    respuestas: [
      'Soy el bot del canal, pero con buen gusto musical 😎',
      'Bot, si. Pero un bot con sentimientos y todo 🎧',
      'Soy un programa, aunque me gusta mas pensar que soy el DJ invisible 👻',
    ],
  },
  {
    id: 'cancion',
    prueba: (t) => /(que canción|que tema|que suena|track id|como se llama (esta|la) (canción|tema)|shazam)/.test(t),
    respuestas: [
      'Buena pregunta {usuario}, el jefe tiene el tracklist pero no lo suelta 😏',
      'Ese temazo lo pincha el jefe, preguntale en el chat que seguro lo dice 🎧',
      'Ni idea del ID, pero suena brutal 🔥',
    ],
  },
  {
    id: 'genero',
    prueba: (t) => /(que genero|es trance|es techno|es house|que estilo|de que va esto)/.test(t),
    respuestas: [
      'Trance y electronica, de eso va la cosa 🎧',
      'Aquí se viene a escuchar trance del bueno, {usuario}',
      'Trance, progressive y algun clasico de los 90 🎶',
    ],
  },
  {
    id: 'elogio',
    prueba: (t) => /(temazo|buena música|que temaz|increible|brutal|que nivel|me encanta|esta genial|que crack|buen set)/.test(t),
    respuestas: [
      '¡Gracias {usuario}! El jefe se lo curra mucho 🎧',
      '¡Ese es el espiritu! 🔥',
      'Se agradece {usuario}, se lo paso al DJ 💜',
    ],
  },
  {
    id: 'follow',
    prueba: (t) => /(te sigo|ya te sigo|seguido|follow hecho|dale follow|te he seguido|suscrito)/.test(t),
    respuestas: [
      '¡Mil gracias {usuario}! 💜 Eso ayuda un monton al canal',
      '¡Grande {usuario}! Bienvenido a bordo 🎧',
      'Gracias por el follow {usuario}, se agradece de verdad 🔥',
    ],
  },
  {
    id: 'risa',
    prueba: (t) => /^(ja)+j?$|^(lol|lmao|xd+|jeje+|jaja+)/.test(t),
    respuestas: [
      'jajaja 😄',
      'Me alegro de que te haga gracia {usuario} 😂',
      'jajaja que crack',
    ],
  },
  {
    id: 'musica_produccion',
    prueba: (t) => /(fl studio|ableton|logic|cubase|serum|sylenth|vst|sintetizador|produccion|produciendo|mezclar)/.test(t),
    respuestas: [
      'Aquí se produce con FL Studio, el jefe es de los de toda la vida 🎹',
      'Buen tema {usuario}, la produccion de trance tiene su miga 🎛️',
      'Los VSTs son un vicio, lo entiendo perfectamente 😅',
    ],
  },
  {
    id: 'equipo',
    prueba: (t) => /(que altavoces|que monitores|que cascos|que auriculares|focusrite|interfaz|mesa de mezclas)/.test(t),
    respuestas: [
      'El jefe va con Focusrite y monitores, pregunta por el chat y te cuenta 🎧',
      'Buen ojo {usuario}, aquí hay equipo de verdad 😎',
    ],
  },
  {
    id: 'pregunta_generica',
    prueba: (t) => /\?$/.test(t) || /^(que|como|cual|cuando|donde|por que|quien)\b/.test(t),
    respuestas: [
      'Buena pregunta {usuario}... a ver si alguien del chat sabe mas que yo 🤔',
      'Mmm, eso lo dejo en manos del jefe del canal 😅',
      'Ni idea {usuario}, pero me quedo a leer la respuesta 👀',
      'Eso es mas de humanos, yo solo pincho música 🎧',
    ],
  },
  {
    id: 'aburrido',
    prueba: (t) => /(no hay nadie|esta muerto|que aburrido|nadie habla|solo estoy yo)/.test(t),
    respuestas: [
      'Tranquilo {usuario}, que el set acaba de empezar 🎶',
      'Aquí sigo yo para hacer compania 🎧',
      'El chat siempre va por rachas, ahora arranca 🔥',
    ],
  },
  {
    id: 'insulto_bot',
    prueba: (t) => /(bot de mierda|bot tonto|eres malo|vete a la|no sirves|eres inutil)/.test(t),
    respuestas: [
      'Vale, vale... me lo apunto 🥲',
      'Tampoco es para tanto {usuario} 😅',
      'Con carino, por favor 💜',
    ],
  },
  {
    id: 'juegos',
    prueba: (t) => /(jugamos|un juego|hay juegos|que juegos|quiero jugar)/.test(t),
    respuestas: [
      '¡Pues claro! Escribe !juegos y te digo todo lo que hay 🎮',
      'Tenemos ahorcado, tres en raya, trivia y mas. Prueba !juegos 🎮',
    ],
  },
];

// ---------------------------------------------------------------
//  RESPUESTAS POR TEMA (para "seguir" la conversacion)
// ---------------------------------------------------------------
const TEMAS = [
  { claves: ['trance', 'psytrance', 'uplifting'], respuestas: ['El trance es puro sentimiento 🎧', 'Uplifting para llorar y bailar a la vez 🔥'] },
  { claves: ['techno', 'hardtechno'], respuestas: ['Techno del oscuro, me gusta como piensas 😎', 'Otro del club de los 130+ BPM 👊'] },
  { claves: ['house', 'deep house'], respuestas: ['El house nunca falla 🎶', 'Buen gusto, aunque el jefe es mas de trance'] },
  { claves: ['vinilo', 'vinilos', 'vinilo'], respuestas: ['Los vinilos suenan a otra cosa 🎵', 'Un hombre de cultura 🍷'] },
  { claves: ['cafe', 'cerveza', 'birra', 'cubata', 'refresco'], respuestas: ['Aquí uno con cafe, que hay que aguantar el set ☕', 'Salud {usuario} 🍻'] },
  { claves: ['fl studio', 'flstudio'], respuestas: ['FL Studio de toda la vida 🎹', 'El piano roll no tiene rival 🎛️'] },
  { claves: ['anime', 'manga'], respuestas: ['Otro del club del anime 👀 ¿cual es tu favorito?', 'Aquí hay cultura japonesa, me gusta'] },
  { claves: ['gato', 'gatos', 'michi'], respuestas: ['Los gatos siempre ganan 🐱', 'Michi detectado, apruebo este chat'] },
  { claves: ['perro', 'perros'], respuestas: ['Buen chico 🐶', 'Los perros son lo mas'] },
  { claves: ['dormir', 'sueno', 'cansado'], respuestas: ['Aguanta un ratito mas {usuario}, que viene lo mejor 😴', 'Ponte un cafe y sigue con nosotros ☕'] },
  { claves: ['curro', 'trabajo', 'trabajando'], respuestas: ['Buen acompañante para trabajar 🎧', 'El trance hace el curro mas llevadero 💪'] },
  { claves: ['lunes', 'viernes', 'finde', 'sabado'], respuestas: ['El finde es sagrado para escuchar música 🎉', 'Aquí da igual el dia, siempre hay set'] },
  { claves: ['90', 'noventa', 'clasico', 'clasicos'], respuestas: ['Los 90 fueron otra cosa 🔥', 'Clasicos de los 90, que recuerdos 🎧'] },
  { claves: ['fiesta', 'bailar', 'baile'], respuestas: ['Aquí ya estamos bailando sentados 💃', 'Sube el volumen y a bailar 🕺'] },
  { claves: ['futbol', 'partido'], respuestas: ['Del futbol hablo poco, que me lio 😅', 'Aquí venimos a lo que venimos: música 🎧'] },
];

// ---------------------------------------------------------------
//  RESPUESTAS GENERICAS (cuando no encaja nada)
// ---------------------------------------------------------------
const GENERICAS = [
  'Pues tiene sentido, {usuario}',
  'Buena {usuario}, no lo habia pensado así',
  'Totalmente de acuerdo 👌',
  'Eso es, {usuario} 🎧',
  'A mi me vale cualquier plan que lleve música de fondo 🎶',
  'jajaja que bueno',
  'Y tanto, {usuario}',
  'Apuntado en mi lista mental 📝',
  'Eso mismo pienso yo 🔥',
  'Vaya, interesante 👀',
];

export function cerebroLocal({ cfg }) {
  return {
    // Devuelve un texto de respuesta o null si es mejor callarse
    responder({ texto, usuario, contexto }) {
      const t = sinTildes(String(texto || '').toLowerCase());
      const ctx = { mencionaBot: Boolean(contexto?.[0]?.mencionaBot) };
      const datos = { usuario, texto: t, ctx };

      for (const intencion of INTENCIONES) {
        try {
          if (intencion.prueba(t, ctx)) {
            return AZAR(intencion.respuestas).replace(/\{usuario\}/g, usuario);
          }
        } catch { /* regla rota: la ignoramos */ }
      }

      // Respuesta por tema
      for (const tema of TEMAS) {
        if (tema.claves.some((c) => t.includes(c))) {
          return AZAR(tema.respuestas).replace(/\{usuario\}/g, usuario);
        }
      }

      // Si el mensaje tiene sustancia, a veces contestamos algo generico
      if (t.length > 12 && Math.random() < 0.5) {
        return AZAR(GENERICAS).replace(/\{usuario\}/g, usuario);
      }

      return null;
    },
  };
}
