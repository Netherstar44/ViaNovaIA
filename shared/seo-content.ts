/**
 * Fuente única de verdad para el SEO de VIANova.
 *
 * La usan el cliente (metadatos por ruta), el generador de páginas estáticas
 * del build y el sitemap. Si cambias un dominio, un título o una URL, cámbialo
 * aquí y vuelve a compilar.
 */

/** Dominio canónico. El otro dominio debe declarar este como canonical. */
export const SITE_URL = "https://via-nova-ia.vercel.app";
export const SECONDARY_URL = "https://vianova.netherstar44.workers.dev";
export const BRAND_NAME = "VIANova";
export const BRAND_SHORT = "VIANova";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_LOCALE = "es_CO";
export const CONTENT_UPDATED = "2026-10-27";

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SeoLink = {
  href: string;
  label: string;
  description: string;
};

export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  keywords: string[];
  sections: SeoSection[];
  faqs: SeoFaq[];
  related: SeoLink[];
  /** Si existe, se emite TouristDestination + TouristAttraction. */
  destination?: {
    name: string;
    region: string;
    latitude: number;
    longitude: number;
    attractions: string[];
  };
};

export const seoPages: SeoPage[] = [
  {
    slug: "planificador-viajes-ia",
    title: "Planificador de Viajes con IA | VIANova",
    description:
      "Crea un itinerario personalizado con inteligencia artificial: hoteles, restaurantes, experiencias y transporte en un solo plan. Prueba VIANova gratis.",
    h1: "Planificador de viajes con IA: tu itinerario completo en minutos",
    intro:
      "VIANova convierte una idea suelta —«quiero conocer el Huila en cuatro días»— en un plan con alojamiento, comida, experiencias, mapa y transporte. No es una lista genérica: es un itinerario que puedes ajustar, reservar y compartir.",
    keywords: [
      "planificador de viajes con IA",
      "itinerario con inteligencia artificial",
      "planificar viaje Colombia",
      "asistente de viajes IA",
      "organizar viaje online",
    ],
    sections: [
      {
        heading: "Qué hace un planificador de viajes con IA",
        paragraphs: [
          "Un planificador de viajes con inteligencia artificial combina tus preferencias (fechas, presupuesto, ritmo, intereses) con información de destinos y servicios para proponer una ruta coherente. En lugar de abrir veinte pestañas, describes el viaje una vez y recibes una propuesta editable.",
          "En VIANova el plan resultante incluye días, paradas, tiempos estimados y una selección de servicios locales. Puedes pedir cambios en lenguaje natural: «menos museos», «con niños», «sin madrugar» o «presupuesto de 1.500.000 COP».",
        ],
      },
      {
        heading: "Cómo crear tu itinerario en cinco pasos",
        paragraphs: [
          "El flujo está pensado para que pases de la idea a la reserva sin fricción. No necesitas cuenta para explorar; solo para guardar y reservar.",
        ],
        bullets: [
          "Cuenta a la IA el destino, las fechas, cuántos viajan y el presupuesto aproximado.",
          "Añade intereses: gastronomía, naturaleza, cultura, aventura, descanso o vida nocturna.",
          "Revisa el itinerario propuesto y pide ajustes en el chat.",
          "Explora cada parada en el mapa, revisa reseñas y compara opciones cercanas.",
          "Reserva con los proveedores locales y guarda el plan en tu cuenta.",
        ],
      },
      {
        heading: "Qué incluye un plan de VIANova",
        paragraphs: [
          "El objetivo es cubrir el viaje completo, no solo el vuelo. Por eso el plan integra alojamiento, gastronomía, experiencias y movilidad en una misma línea de tiempo.",
        ],
        bullets: [
          "Alojamientos por zona, con rango de precio y cercanía a las paradas.",
          "Restaurantes y experiencias locales según tus intereses.",
          "Mapa interactivo con la ruta y las paradas del día.",
          "Tours virtuales y modelos 3D en fichas compatibles.",
          "Transporte y taxi local para tramos dentro de la ciudad.",
          "Resumen de presupuesto estimado y alternativas por día.",
        ],
      },
      {
        heading: "Para quién funciona mejor",
        paragraphs: [
          "Funciona para viajeros independientes que quieren ordenar opciones, para familias que necesitan coordinar horarios y para anfitriones que quieren promocionar su oferta local. También sirve a empresas que organizan salidas cortas o viajes de equipo.",
          "Si viajas por primera vez a Colombia, el planificador ayuda a dimensionar distancias y temporadas. Si ya conoces el destino, acelera la parte operativa: dónde dormir, qué reservar y cómo moverte.",
        ],
      },
      {
        heading: "Cómo escribir una buena petición a la IA",
        paragraphs: [
          "La calidad del plan depende de la calidad del contexto. Una petición útil incluye cinco datos: destino, fechas o temporada, número de viajeros, presupuesto y ritmo deseado. Añade restricciones reales (movilidad, alergias, niños pequeños) y el plan se vuelve mucho más preciso.",
          "Evita instrucciones contradictorias como «todo incluido y muy barato» sin margen. Es mejor pedir prioridades: «naturaleza primero, ciudad solo un día».",
        ],
      },
      {
        heading: "Planificador con IA frente a una agencia tradicional",
        paragraphs: [
          "Una agencia aporta experiencia y respaldo en viajes complejos; un planificador con IA aporta velocidad, comparación y control del presupuesto. No son excluyentes. Muchos viajeros usan la IA para diseñar el borrador y luego confirman con proveedores locales.",
          "VIANova no cobra por crear el itinerario y no impone un paquete cerrado. La reserva se hace con cada proveedor, con sus condiciones visibles.",
        ],
      },
    ],
    faqs: [
      {
        question: "¿VIANova es gratis?",
        answer:
          "Puedes explorar destinos y crear una propuesta de viaje sin costo. Algunas funciones de cuenta, reservas y servicios de proveedores pueden requerir iniciar sesión o tener condiciones propias.",
      },
      {
        question: "¿El itinerario se puede modificar?",
        answer:
          "Sí. Puedes pedir cambios en el chat, cambiar el orden de las paradas, acortar días o ajustar el presupuesto. El plan queda guardado en tu cuenta para editarlo después.",
      },
      {
        question: "¿La IA reserva por mí?",
        answer:
          "La IA prepara el plan y te muestra los servicios disponibles. La reserva se confirma con el proveedor y sus condiciones, no de forma automática sin tu aprobación.",
      },
      {
        question: "¿Funciona para viajes fuera de Colombia?",
        answer:
          "Sí, aunque la cobertura de proveedores locales es mayor en Colombia, especialmente en Neiva y el Huila. En otros destinos el planificador sigue siendo útil para estructurar el itinerario.",
      },
      {
        question: "¿Qué pasa si no sé cuánto presupuestar?",
        answer:
          "Indica un rango aproximado y el planificador propondrá alternativas económicas, intermedias y de lujo. Siempre conviene sumar un 10-15 % de margen para imprevistos.",
      },
      {
        question: "¿Puedo usar el plan sin conexión?",
        answer:
          "Puedes instalar la aplicación como PWA para abrirla desde el inicio, pero el mapa, las reservas y el chat requieren conexión a internet.",
      },
    ],
    related: [
      {
        href: "/viajes-colombia",
        label: "Viajes por Colombia",
        description: "Destinos, rutas de 7 a 21 días y la mejor temporada para viajar.",
      },
      {
        href: "/que-hacer-en-neiva",
        label: "Qué hacer en Neiva y el Huila",
        description: "Tatacoa, termales, gastronomía y un itinerario de 4 días.",
      },
      {
        href: "/comparar-trivago-airbnb",
        label: "Trivago vs Airbnb",
        description: "Cómo comparar el precio final y elegir alojamiento sin sorpresas.",
      },
    ],
  },
  {
    slug: "viajes-colombia",
    title: "Viajes por Colombia: Destinos, Rutas y Temporadas | VIANova",
    description:
      "Guía para viajar por Colombia: 10 destinos imperdibles, rutas de 7, 14 y 21 días, temporadas, presupuesto y consejos prácticos. Planifica con IA.",
    h1: "Viajes por Colombia: destinos, rutas y temporadas",
    intro:
      "Colombia tiene costa caribe, montaña, desierto, selva y ciudades que mezclan historia y gastronomía. La dificultad no es encontrar qué ver, sino ordenar un viaje que no te obligue a cruzar el país cada dos días. Esta guía te ayuda a elegir la ruta.",
    keywords: [
      "viajes por Colombia",
      "destinos turísticos de Colombia",
      "rutas por Colombia",
      "qué visitar en Colombia",
      "viajar a Colombia",
    ],
    sections: [
      {
        heading: "Los 10 destinos que más rinden en un primer viaje",
        paragraphs: [
          "No existe una ruta única, pero estos destinos cubren lo esencial y se conectan bien por aire o carretera. Elige tres o cuatro por viaje; intentar más suele significar pasar el día en terminales.",
        ],
        bullets: [
          "Cartagena: centro histórico amurallado, Getsemaní y acceso a islas.",
          "Tayrona y Santa Marta: playas, selva y Sierra Nevada.",
          "Medellín y Guatapé: cultura urbana, miradores y embalse.",
          "Eje Cafetero: Salento, Valle del Cocora y fincas cafeteras.",
          "Bogotá: museos, Monserrate y gastronomía.",
          "San Andrés y Providencia: mar de siete colores y buceo.",
          "Caño Cristales: río de colores en temporada (aproximadamente junio a noviembre).",
          "San Agustín: arqueología y paisaje andino en el Huila.",
          "Desierto de la Tatacoa y Neiva: astronomía, desierto y río Magdalena.",
          "Amazonas desde Leticia: selva, comunidades y río.",
        ],
      },
      {
        heading: "Rutas sugeridas: 7, 14 y 21 días",
        paragraphs: [
          "Estas rutas priorizan menos traslados y más tiempo en cada lugar. Puedes adaptarlas según la temporada y tu presupuesto.",
        ],
        bullets: [
          "7 días: Bogotá (2) → Eje Cafetero (3) → Medellín (2).",
          "14 días: Cartagena (3) → Tayrona (3) → Medellín (3) → Eje Cafetero (3) → Bogotá (2).",
          "21 días: añade San Agustín o Tatacoa (3) y Amazonas (3), o cambia la costa por San Andrés.",
          "Ruta cultural: Bogotá → Villa de Leyva → San Agustín → Popayán.",
        ],
      },
      {
        heading: "Cuándo viajar según la región",
        paragraphs: [
          "Colombia no tiene una sola temporada. La costa caribe es más seca entre diciembre y abril; la región andina tiene dos periodos relativamente secos (diciembre-marzo y julio-agosto); la Amazonía y el Pacífico son húmedos todo el año.",
          "Para el Desierto de la Tatacoa, los meses secos favorecen la observación astronómica. Para Caño Cristales, la ventana depende del nivel del río y de las autoridades del parque; confirma antes de comprar.",
        ],
      },
      {
        heading: "Presupuesto orientativo",
        paragraphs: [
          "Un viajero mochilero puede moverse con 120.000-200.000 COP diarios en alojamiento compartido, comida local y transporte público. Un viaje de confort medio suele estar entre 300.000 y 600.000 COP por persona y día. Los vuelos internos y los destinos de playa elevan el promedio.",
          "Reserva con antelación en temporada alta (diciembre-enero, Semana Santa y mitad de año). En ciudades intermedias, el alojamiento puede variar mucho entre semana y fin de semana.",
        ],
      },
      {
        heading: "Seguridad, movilidad y etiqueta",
        paragraphs: [
          "Usa transporte registrado, evita mostrar objetos de valor y consulta el estado de las vías antes de salir a carretera. En ciudades grandes, apps de movilidad y taxis oficiales son la opción más predecible. En zonas rurales, confirma horarios de transporte con el alojamiento.",
          "El turismo comunitario es una parte valiosa de la experiencia: compra a productores locales, respeta las normas de los parques y no alimentes fauna silvestre.",
        ],
      },
      {
        heading: "Cómo armar el itinerario con IA",
        paragraphs: [
          "Si tienes claro el número de días y el presupuesto, un planificador con IA puede proponer una ruta realista en minutos. Luego revisa distancias, temporadas y disponibilidad. En VIANova puedes ajustar el plan y explorar proveedores locales en el mapa.",
          "La IA no reemplaza la verificación: confirma horarios, accesos y condiciones de cada parque o reserva antes de pagar.",
        ],
      },
    ],
    faqs: [
      {
        question: "¿Cuántos días se necesitan para conocer Colombia?",
        answer:
          "Con 7 días puedes ver dos regiones cercanas. Para una primera visita completa, 14 días permiten combinar costa, montaña y Eje Cafetero sin correr. Con 21 días puedes añadir Amazonía o Huila.",
      },
      {
        question: "¿Es seguro viajar por Colombia?",
        answer:
          "Millones de personas viajan cada año. Como en cualquier país, hay zonas y horarios que requieren precaución. Usa transporte registrado, infórmate sobre las rutas y sigue las recomendaciones locales.",
      },
      {
        question: "¿Cuál es la mejor época para visitar la costa caribe?",
        answer:
          "La temporada más seca va de diciembre a abril. De mayo a noviembre hay más lluvia y también más probabilidad de descuentos, aunque el clima puede cambiar rápido.",
      },
      {
        question: "¿Necesito visa para Colombia?",
        answer:
          "Depende de tu nacionalidad. Muchos países tienen entrada sin visa por turismo durante un periodo limitado. Verifica siempre con el consulado o la autoridad migratoria antes de viajar.",
      },
      {
        question: "¿Se puede viajar solo con tarjeta?",
        answer:
          "En ciudades y hoteles sí, pero conviene llevar efectivo para transporte rural, artesanos, propinas y pequeños establecimientos. Avisa a tu banco si viajas desde el exterior.",
      },
    ],
    related: [
      {
        href: "/planificador-viajes-ia",
        label: "Planificador de viajes con IA",
        description: "Convierte esta guía en un itinerario ajustado a tus fechas.",
      },
      {
        href: "/que-hacer-en-neiva",
        label: "Neiva y el Huila",
        description: "Una ruta de 4 días entre desierto, termales y san Agustín.",
      },
      {
        href: "/comparar-trivago-airbnb",
        label: "Comparar alojamiento",
        description: "Trivago, Airbnb o reserva directa: qué revisar antes de pagar.",
      },
    ],
  },
  {
    slug: "que-hacer-en-neiva",
    title: "Qué Hacer en Neiva y el Huila: 12 Planes | VIANova",
    description:
      "Qué hacer en Neiva y el Huila: Desierto de la Tatacoa, termales de Rivera, Museo Paleontológico, gastronomía y rutas de 2 y 4 días. Guía práctica.",
    h1: "Qué hacer en Neiva y el Huila: 12 planes entre desierto, río y montaña",
    intro:
      "Neiva es la puerta de entrada al Huila: una ciudad cálida junto al río Magdalena, con el Desierto de la Tatacoa a menos de una hora y pueblos de montaña a pocas horas. Esta guía ordena los planes por tiempo e interés.",
    keywords: [
      "qué hacer en Neiva",
      "turismo en Neiva",
      "Desierto de la Tatacoa",
      "qué visitar en el Huila",
      "turismo en el Huila",
    ],
    destination: {
      name: "Neiva y el Huila",
      region: "Huila, Colombia",
      latitude: 2.9273,
      longitude: -75.2819,
      attractions: [
        "Desierto de la Tatacoa",
        "Museo Paleontológico de Neiva",
        "Malecón del Río Magdalena",
        "Parque Santander",
        "Termales de Rivera",
        "San Agustín",
      ],
    },
    sections: [
      {
        heading: "Neiva en un día: centro, río y gastronomía",
        paragraphs: [
          "Empieza por el Parque Santander, el corazón de la ciudad, y la Catedral de la Inmaculada Concepción. A pocas cuadras está el Museo Paleontológico, con fósiles de la Tatacoa y piezas arqueológicas del Huila. Si el calor aprieta, el Malecón del Río Magdalena es un buen cierre de tarde.",
          "Para comer, busca asado huilense, tamal, insulso y bizcocho de achira. Los mercados y restaurantes de comida corriente suelen ser la opción más auténtica y económica.",
        ],
      },
      {
        heading: "Desierto de la Tatacoa: el plan imperdible",
        paragraphs: [
          "El desierto está en Villavieja, a unos 38 km de Neiva. Tiene dos sectores: el desierto rojo, con cárcavas y miradores, y el gris, con paisajes más erosionados. El observatorio astronómico de la Tatacoa es uno de los mejores lugares de Colombia para ver el cielo nocturno.",
          "Ve temprano o al final de la tarde para evitar el calor fuerte. Lleva agua, protector solar, sombrero y calzado cerrado. Si te quedas a observar estrellas, reserva alojamiento en Villavieja o cerca del desierto y confirma el transporte de regreso.",
        ],
      },
      {
        heading: "Rivera, termales y cascadas",
        paragraphs: [
          "Rivera está a unos 20 km de Neiva y es conocida por sus aguas termales y clima más fresco. Es un plan de medio día o de fin de semana. En los alrededores también hay caminatas y miradores.",
          "Hacia Gigante y el cañón del río Magdalena encontrarás cascadas y paisajes de montaña. Las condiciones cambian con la lluvia: confirma el estado de los caminos y ve con guía local si no conoces la zona.",
        ],
      },
      {
        heading: "San Agustín y el sur del Huila",
        paragraphs: [
          "San Agustín es Patrimonio de la Humanidad por su parque arqueológico y su paisaje de montaña. Está a unas 4-5 horas por carretera desde Neiva, así que merece al menos dos noches. Combínalo con el Estrecho del Magdalena y el Bosque de las Estatuas.",
          "Si viajas en temporada de lluvias, lleva ropa impermeable y calzado con agarre. La carretera de montaña puede ser lenta; calcula los tiempos con margen.",
        ],
      },
      {
        heading: "Itinerario de 2 días en Neiva",
        paragraphs: [
          "Día 1: centro histórico, Museo Paleontológico y Malecón. Cena de comida huilense. Día 2: salida temprano a la Tatacoa, recorrido por el desierto rojo y el gris, y regreso a Neiva al atardecer. Si quieres observar estrellas, cambia el orden y duerme en Villavieja.",
        ],
      },
      {
        heading: "Itinerario de 4 días: Neiva, Tatacoa y Rivera",
        paragraphs: [
          "Día 1: Neiva urbana. Día 2: Tatacoa y observatorio. Día 3: termales de Rivera y caminata corta. Día 4: Gigante o regreso a Neiva para probar mercados y comprar artesanías. Con dos días más, añade San Agustín.",
        ],
      },
      {
        heading: "Cómo llegar y moverse",
        paragraphs: [
          "El aeropuerto Benito Salas (NVA) conecta Neiva con Bogotá y otras ciudades. La terminal de transportes tiene rutas regionales. Dentro de la ciudad, taxi y apps de movilidad son prácticas; para la Tatacoa conviene contratar transporte turístico o tour organizado.",
          "Si alquilas carro, revisa el estado de las vías y evita conducir de noche en carreteras rurales. En el desierto no hay sombra ni servicios continuos.",
        ],
      },
      {
        heading: "Cuándo ir y qué llevar",
        paragraphs: [
          "Neiva es cálida durante todo el año. La temporada seca (diciembre-marzo y julio-agosto) es la mejor para el desierto y las caminatas. Lleva ropa ligera, gorra, bloqueador, repelente, botella de agua y una chaqueta fina para la noche en la Tatacoa.",
          "Para San Agustín y Rivera, suma ropa de abrigo y calzado de trekking. El clima de montaña cambia rápido.",
        ],
      },
      {
        heading: "Dónde dormir y comer",
        paragraphs: [
          "En Neiva hay hoteles de cadena y opciones boutique cerca del centro y del malecón. En Villavieja, la oferta es más pequeña y conviene reservar con antelación en temporada alta. En Rivera abundan fincas y alojamientos rurales.",
          "Para comer, prueba el asado huilense en restaurantes de barrio, el tamal en desayuno y el bizcocho de achira como snack. En VIANova puedes explorar proveedores locales, ver reseñas y ubicarlos en el mapa.",
        ],
      },
    ],
    faqs: [
      {
        question: "¿Cuánto tiempo se necesita para la Tatacoa?",
        answer:
          "Un recorrido de un día desde Neiva alcanza para los dos sectores, pero quedarse una noche permite ver el cielo y evitar las horas de más calor. Calcula entre 45 minutos y una hora hasta Villavieja.",
      },
      {
        question: "¿Se puede visitar la Tatacoa sin tour?",
        answer:
          "Sí, con transporte propio o contratado hasta Villavieja. Dentro del desierto es recomendable un guía local para ubicar los miradores y entender el terreno. No hay servicios continuos.",
      },
      {
        question: "¿Qué hacer en Neiva si llueve?",
        answer:
          "Museo Paleontológico, centro histórico, cafés y gastronomía. También puedes aprovechar para organizar el viaje a Rivera o San Agustín con proveedores locales.",
      },
      {
        question: "¿Cómo llegar de Neiva a San Agustín?",
        answer:
          "Por carretera, con una duración aproximada de 4 a 5 horas según la ruta y el tráfico. Hay buses intermunicipales y opciones privadas; confirma horarios el día anterior.",
      },
      {
        question: "¿Es seguro visitar el Huila?",
        answer:
          "Las zonas turísticas principales reciben visitantes de forma habitual. Usa transporte registrado, respeta las indicaciones de los parques y consulta el estado de las vías antes de salir a carretera.",
      },
    ],
    related: [
      {
        href: "/planificador-viajes-ia",
        label: "Arma tu itinerario del Huila",
        description: "Pide un plan de 2, 4 o 7 días y ajústalo en el chat.",
      },
      {
        href: "/viajes-colombia",
        label: "Viajes por Colombia",
        description: "Conecta el Huila con el Eje Cafetero, Bogotá o la costa.",
      },
      {
        href: "/comparar-trivago-airbnb",
        label: "Dónde alojarte",
        description: "Compara hotel, apartamento y reserva directa antes de pagar.",
      },
    ],
  },
  {
    slug: "comparar-trivago-airbnb",
    title: "Trivago vs Airbnb: Cómo Comparar y Elegir | VIANova",
    description:
      "Trivago y Airbnb no son lo mismo: metasearch frente a marketplace. Compara precio final, cargos, cancelación y ubicación antes de reservar tu alojamiento.",
    h1: "Trivago vs Airbnb: cómo comparar y elegir sin pagar de más",
    intro:
      "Trivago y Airbnb compiten por la misma búsqueda —dónde dormir— pero funcionan de forma distinta. Entender el modelo de cada uno evita comparar precios que no incluyen lo mismo. Esta guía es independiente y no está patrocinada por ninguna de las dos marcas.",
    keywords: [
      "Trivago vs Airbnb",
      "comparar hoteles y apartamentos",
      "dónde reservar alojamiento",
      "precio final alojamiento",
      "alternativa a Trivago",
    ],
    sections: [
      {
        heading: "Qué es Trivago y qué es Airbnb",
        paragraphs: [
          "Trivago es un metabuscador: reúne ofertas de hoteles publicadas por agencias de viajes y sitios de reserva, y te redirige al vendedor para completar la compra. Airbnb es un marketplace: el anfitrión publica el alojamiento y la reserva se gestiona dentro de la plataforma.",
          "Esa diferencia cambia quién responde por la reserva, qué cargos aparecen y cómo se compara el precio. Una tarifa barata en un metabuscador puede no incluir impuestos o cancelación flexible.",
        ],
      },
      {
        heading: "Comparación rápida",
        paragraphs: [
          "Ninguna opción es mejor siempre. La decisión depende del tipo de viaje, la duración y cuánto valores la estandarización del servicio.",
        ],
        bullets: [
          "Inventario: Trivago muestra hoteles y algunos apartamentos de agencias; Airbnb tiene casas, apartamentos y habitaciones de anfitriones.",
          "Precio: Trivago compara tarifas de terceros; Airbnb muestra el precio del anfitrión con cargos de servicio.",
          "Cargos: revisa impuestos, limpieza, servicio y depósito en ambas opciones.",
          "Cancelación: cada tarifa y cada anfitrión tiene condiciones distintas.",
          "Atención: en Trivago la compra la atiende el vendedor final; en Airbnb, la plataforma y el anfitrión.",
          "Mejor para: hotel con servicios y estancia corta (Trivago); grupos, cocina y estancias largas (Airbnb).",
        ],
      },
      {
        heading: "Los costos que suelen escaparse",
        paragraphs: [
          "El precio por noche no es el precio final. En hoteles, suma impuestos, resort fee, estacionamiento y desayuno. En apartamentos, suma limpieza, servicio, depósito y posibles cargos por late check-out. También cuenta el transporte: un alojamiento barato lejos del centro puede costar más en taxis.",
          "Convierte todo a una sola cifra: costo total de la estancia dividido por noches y por personas. Esa es la métrica que permite comparar de verdad.",
        ],
      },
      {
        heading: "Siete pasos para comparar bien",
        paragraphs: [
          "Haz la comparación con el mismo filtro en ambas plataformas y en el mismo momento. Los precios cambian por disponibilidad y moneda.",
        ],
        bullets: [
          "Fija fechas, número de huéspedes y zona exacta.",
          "Activa la vista de precio total, con impuestos y cargos.",
          "Lee las condiciones de cancelación y el horario de check-in.",
          "Revisa reseñas recientes, no solo el promedio.",
          "Comprueba la ubicación real en el mapa y el transporte disponible.",
          "Verifica si el cobro se hace ahora o al llegar.",
          "Guarda capturas de la tarifa y el número de confirmación.",
        ],
      },
      {
        heading: "Cuándo conviene reservar directo",
        paragraphs: [
          "Si el hotel tiene web propia, compara la tarifa directa con la del metabuscador. A veces incluye desayuno, cancelación flexible o mejor habitación por el mismo precio. También facilita cambios y facturación.",
          "En apartamentos, la reserva directa con el anfitrión solo es recomendable si hay contrato, pago trazable y reputación verificable. Fuera de la plataforma pierdes la protección de la intermediación.",
        ],
      },
      {
        heading: "Cómo encaja VIANova",
        paragraphs: [
          "VIANova no es una agencia de viajes ni un metabuscador de hoteles: es un planificador que organiza tu viaje y te muestra proveedores locales. Puedes usarlo para decidir la zona, el número de noches y el presupuesto antes de comparar en Trivago, Airbnb o la web del hotel.",
          "Después de reservar, vuelve al plan para añadir restaurantes, experiencias y transporte. Así evitas reservar un alojamiento que está lejos de todo lo que quieres hacer.",
        ],
      },
    ],
    faqs: [
      {
        question: "¿Trivago y Airbnb son lo mismo?",
        answer:
          "No. Trivago es un metabuscador que compara ofertas de terceros; Airbnb es un marketplace donde los anfitriones publican alojamientos y la reserva se gestiona en la plataforma.",
      },
      {
        question: "¿Cuál es más barato?",
        answer:
          "Depende de la ciudad, las fechas y el tipo de alojamiento. Para estancias cortas en hotel suele convenir comparar tarifas; para grupos o estancias largas, un apartamento con cocina puede reducir el costo total.",
      },
      {
        question: "¿Los precios de Trivago incluyen impuestos?",
        answer:
          "No siempre. Algunas tarifas los muestran aparte y otras los incluyen. Antes de pagar, revisa el desglose final en el sitio del vendedor.",
      },
      {
        question: "¿Es seguro reservar por Airbnb?",
        answer:
          "La plataforma ofrece pagos y comunicaciones dentro del sistema, además de políticas de cancelación y soporte. Revisa el perfil del anfitrión, las reseñas y las normas de la casa antes de reservar.",
      },
      {
        question: "¿VIANova está afiliada a Trivago o Airbnb?",
        answer:
          "No. VIANova es un planificador de viajes independiente. Trivago y Airbnb son marcas de sus respectivos titulares y se mencionan únicamente con fines comparativos.",
      },
    ],
    related: [
      {
        href: "/planificador-viajes-ia",
        label: "Planifica antes de reservar",
        description: "Define zona, noches y presupuesto con un itinerario claro.",
      },
      {
        href: "/viajes-colombia",
        label: "Viajes por Colombia",
        description: "Rutas y temporadas para elegir mejor las fechas.",
      },
      {
        href: "/que-hacer-en-neiva",
        label: "Neiva y el Huila",
        description: "Qué hacer cerca de tu alojamiento en el Huila.",
      },
    ],
  },
];

export const seoPageBySlug = new Map(seoPages.map((page) => [page.slug, page]));

export function pagePath(slug: string): string {
  return `/${slug}`;
}

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${clean === "/" ? "/" : clean.replace(/\/+$/, "")}`;
}

export type RouteSeo = {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogType: string;
  image: string;
  jsonLd?: Record<string, unknown>;
  keywords?: string[];
};

const HOME_SEO: RouteSeo = {
  title: "VIANova | Planificador de Viajes con IA en Colombia",
  description:
    "Planifica tu viaje con inteligencia artificial: itinerarios, hoteles, restaurantes, experiencias y taxi local en un solo lugar. Explora Colombia con VIANova.",
  canonical: absoluteUrl("/"),
  robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  ogType: "website",
  image: DEFAULT_OG_IMAGE,
  keywords: [
    "planificador de viajes con IA",
    "viajes",
    "turismo",
    "turismo en Colombia",
    "hoteles",
    "restaurantes",
    "experiencias",
    "Neiva",
    "Huila",
  ],
};

const PUBLIC_ROUTE_SEO: Record<string, RouteSeo> = {
  "/": HOME_SEO,
  "/explore": {
    title: "Explorar Destinos, Hoteles y Experiencias | VIANova",
    description:
      "Explora alojamientos, restaurantes, experiencias y servicios locales con mapa, reseñas y filtros. Descubre qué hacer en Neiva, el Huila y Colombia.",
    canonical: absoluteUrl("/explore"),
    robots: "index, follow, max-image-preview:large",
    ogType: "website",
    image: DEFAULT_OG_IMAGE,
    keywords: ["explorar destinos", "hoteles", "restaurantes", "experiencias", "turismo local"],
  },
  "/privacy": {
    title: "Política de Privacidad | VIANova",
    description:
      "Cómo VIANova recopila, usa y protege tus datos personales. Consulta tus derechos y los canales de contacto.",
    canonical: absoluteUrl("/privacy"),
    robots: "index, follow",
    ogType: "website",
    image: DEFAULT_OG_IMAGE,
  },
};

for (const page of seoPages) {
  PUBLIC_ROUTE_SEO[pagePath(page.slug)] = {
    title: page.title,
    description: page.description,
    canonical: absoluteUrl(pagePath(page.slug)),
    robots: "index, follow, max-image-preview:large, max-snippet:-1",
    ogType: "article",
    image: DEFAULT_OG_IMAGE,
    keywords: page.keywords,
  };
}

const PRIVATE_ROUTE_META: Record<string, { title: string; description: string }> = {
  "/login": {
    title: "Iniciar sesión | VIANova",
    description: "Accede a tu cuenta de VIANova para guardar itinerarios, reservar servicios y gestionar tus viajes.",
  },
  "/select-role": {
    title: "Elige tu rol | VIANova",
    description: "Selecciona cómo quieres usar VIANova: viajero, hotel, restaurante, experiencia o transporte.",
  },
  "/dashboard": {
    title: "Mi panel | VIANova",
    description: "Resumen de tu actividad, reservas, compras y viajes en VIANova.",
  },
  "/admin": {
    title: "Administración | VIANova",
    description: "Panel interno de administración de VIANova.",
  },
  "/settings": {
    title: "Configuración de cuenta | VIANova",
    description: "Gestiona tu perfil, seguridad y preferencias en VIANova.",
  },
  "/profile": {
    title: "Mi perfil | VIANova",
    description: "Personaliza tu nombre, avatar, banner y datos de contacto en VIANova.",
  },
  "/my-products": {
    title: "Mis productos | VIANova",
    description: "Gestiona los productos y servicios que publicas en VIANova.",
  },
  "/notifications": {
    title: "Notificaciones | VIANova",
    description: "Tus notificaciones y actividad reciente en VIANova.",
  },
  "/messages": {
    title: "Mensajes | VIANova",
    description: "Conversaciones con viajeros y proveedores en VIANova.",
  },
  "/social": {
    title: "Comunidad | VIANova",
    description: "Contenido y actividad de la comunidad de viajeros de VIANova.",
  },
  "/products": {
    title: "Gestión de productos | VIANova",
    description: "Panel de productos y servicios para proveedores de VIANova.",
  },
  "/request-ride": {
    title: "Solicitar taxi | VIANova",
    description: "Solicita un taxi local y sigue el recorrido en el mapa.",
  },
  "/ride-history": {
    title: "Historial de viajes | VIANova",
    description: "Consulta tus viajes y recorridos anteriores en VIANova.",
  },
};

export function getRouteSeo(pathname: string): RouteSeo {
  const path = normalizePath(pathname);
  const direct = PUBLIC_ROUTE_SEO[path];
  if (direct) {
    const page = seoPageBySlug.get(path.slice(1));
    return { ...direct, jsonLd: page ? pageJsonLd(page) : undefined };
  }

  const privateMeta = PRIVATE_ROUTE_META[path];
  if (privateMeta) {
    return {
      ...privateMeta,
      canonical: absoluteUrl(path),
      robots: "noindex, nofollow",
      ogType: "website",
      image: DEFAULT_OG_IMAGE,
    };
  }

  if (path.startsWith("/u/")) {
    return {
      title: "Perfil de usuario | VIANova",
      description: "Perfil público de un miembro de la comunidad de VIANova.",
      canonical: absoluteUrl(path),
      robots: "noindex, nofollow",
      ogType: "profile",
      image: DEFAULT_OG_IMAGE,
    };
  }

  return {
    title: "Página no disponible | VIANova",
    description: "Esta sección es privada o no existe. Vuelve al inicio para explorar destinos y planificar tu viaje.",
    canonical: absoluteUrl(path),
    robots: "noindex, nofollow",
    ogType: "website",
    image: DEFAULT_OG_IMAGE,
  };
}

export function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    alternateName: BRAND_SHORT,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/brand-icon-512.png`,
      width: 512,
      height: 512,
    },
    description:
      "Planificador de viajes con inteligencia artificial para Colombia: itinerarios, alojamiento, gastronomía, experiencias y movilidad local.",
    areaServed: {
      "@type": "Country",
      name: "Colombia",
    },
    knowsLanguage: ["es-CO", "en", "fr"],
  };
}

export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: BRAND_NAME,
    alternateName: BRAND_SHORT,
    inLanguage: "es-CO",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function softwareAppNode() {
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#app`,
    name: BRAND_NAME,
    applicationCategory: "TravelApplication",
    applicationSubCategory: "Trip planner",
    operatingSystem: "Web, Android",
    url: SITE_URL,
    description:
      "Aplicación de planificación de viajes con IA: crea itinerarios, descubre proveedores locales y organiza alojamiento, gastronomía, experiencias y transporte.",
    inLanguage: "es-CO",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "COP",
      description: "Explorar destinos y crear una propuesta de viaje sin costo.",
    },
    featureList: [
      "Itinerarios personalizados con inteligencia artificial",
      "Descubrimiento de hoteles, restaurantes y experiencias",
      "Mapa interactivo y rutas",
      "Tours virtuales y modelos 3D",
      "Reserva de servicios locales",
      "Taxi y movilidad local",
    ],
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function baseGraph(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode(), websiteNode(), softwareAppNode()],
  };
}

export function pageJsonLd(page: SeoPage): Record<string, unknown> {
  const url = absoluteUrl(pagePath(page.slug));
  const articleId = `${url}#article`;
  const webPageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;
  const faqId = `${url}#faq`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": webPageId,
      url,
      name: page.title,
      description: page.description,
      inLanguage: "es-CO",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE,
      },
      breadcrumb: { "@id": breadcrumbId },
    },
    {
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Inicio",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.h1,
          item: url,
        },
      ],
    },
    {
      "@type": "Article",
      "@id": articleId,
      headline: page.h1,
      description: page.description,
      inLanguage: "es-CO",
      datePublished: CONTENT_UPDATED,
      dateModified: CONTENT_UPDATED,
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      mainEntityOfPage: { "@id": webPageId },
      image: [DEFAULT_OG_IMAGE],
      articleSection: "Guías de viaje",
      keywords: page.keywords.join(", "),
    },
    {
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];

  if (page.destination) {
    graph.push({
      "@type": "TouristDestination",
      "@id": `${url}#destination`,
      name: page.destination.name,
      description: page.intro,
      touristType: ["Familias", "Viajeros independientes", "Parejas", "Mochileros"],
      geo: {
        "@type": "GeoCoordinates",
        latitude: page.destination.latitude,
        longitude: page.destination.longitude,
      },
      address: {
        "@type": "PostalAddress",
        addressRegion: page.destination.region,
        addressCountry: "CO",
      },
      includesAttraction: page.destination.attractions.map((name) => ({
        "@type": "TouristAttraction",
        name,
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
