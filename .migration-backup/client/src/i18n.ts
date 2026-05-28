import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  es: {
    translation: {
      navbar: {
        explore: "Explorar", messages: "Mensajes", social: "Social", admin: "Admin", business: "Mi Negocio", taxi: "Modo Taxi", theme: "Tema", profile: "Perfil", logout: "Cerrar Sesión",
        settings: "Configuración de Cuenta", history: "Historial de Viajes", products: "Mis Productos", taxi_panel: "Panel de Taxista", login: "Iniciar Sesión",
        appearance: "Apariencia", light: "Claro", dark: "Oscuro", language: "Idioma", change_language: "Cambiar idioma", change_theme: "Cambiar tema",
        role_hotel: "Hotel", role_restaurant: "Restaurante", role_recreation: "Recreación", role_taxi: "Taxista", role_translator: "Traductor", role_traveler: "Viajero"
      },
      home: {
        hero_title: "Descubre el mundo con", hero_subtitle: "Explora los destinos más exclusivos, sabores inolvidables y experiencias inmersivas impulsadas por inteligencia artificial.",
        search_placeholder: "Buscar por nombre, descripción o ciudad...", distance: "Distancia", price: "Precio", explore_btn: "Explorar",
        no_results: "No se encontraron resultados", back: "Volver a Explorar", navigate: "Ir al lugar",
        order_taxi: "Ordenar Taxi", hide_taxi: "Ocultar Taxi", "3d_model": "Ver Modelo 3D", virtual_tour: "Explorar Tour Virtual", ask_info: "Solicitar Información",
        filters: "Filtros", popular: "Popular", any: "Cualquiera",
        showing_results: "Mostrando {{limit}} de {{total}} resultados.", load_more: "Ver más resultados",
        nav_tts: "Calculando ruta a {{name}}. La distancia es de {{dist}} kilómetros. Tiempo estimado: {{time}} minutos."
      },
      categories: {
        all: "Todos los Destinos", hotel: "Alojamientos", restaurant: "Gastronomía", recreation: "Experiencias", transport: "Movilidad"
      },
      chatbot: {
        placeholder: "Escribe tu mensaje...", send: "Enviar", start: "¡Hola! Soy tu asistente IA de ViaNova. ¿A dónde quieres ir hoy?",
        voice_on: "Activar voz", voice_off: "Desactivar voz",
        listening: "Escuchando...", speaking: "VIANova está hablando...", tap_mic: "Toca el micrófono para hablar",
        note: "Nota", gps_warning: "El GPS automático en computadoras puede ser impreciso.", auto_gps: "Usar GPS Automático",
        or_manual: "O ingresa manualmente", destination: "Destino de viaje:",
        error_processing: "Hubo un error al procesar tu mensaje. Intenta nuevamente.",
        location_shared: "📍 He compartido mi ubicación actual.",
        location_received: "Ubicación recibida.",
        location_error: "No pude acceder a tu ubicación. Por favor revisa los permisos de tu navegador.",
        manual_location: "📍 Mi ubicación es: {{val}}",
        image_attached: "He adjuntado una referencia visual:",
        image_received: "He recibido la imagen. ¡Se ve increíble! ¿Qué te gustaría saber o encontrar relacionado a este estilo?",
        image_error: "No pude cargar la imagen, el archivo es inválido o muy pesado.",
        bookings_sent: "¡Solicitudes enviadas a todos los proveedores!",
        confirm_bookings: "Confirmar y Enviar Reservas"
      },
      comments: {
        title: "Reseñas y Comentarios", your_rating: "Tu calificación:", placeholder: "Comparte tu experiencia...",
        submit_btn: "Publicar comentario", submitting: "Enviando...", loading: "Cargando comentarios...", empty: "Sé el primero en comentar.",
        required_title: "Contenido requerido", required_desc: "Escribe un comentario antes de enviar.",
        success_title: "Comentario publicado", success_desc: "Gracias por tu aporte.",
        deleted_title: "Comentario eliminado", deleted_desc: "Tu reseña ha sido borrada."
      }
    }
  },
  en: {
    translation: {
      navbar: {
        explore: "Explore", messages: "Messages", social: "Social", admin: "Admin", business: "My Business", taxi: "Taxi Mode", theme: "Theme", profile: "Profile", logout: "Sign Out",
        settings: "Account Settings", history: "Trip History", products: "My Products", taxi_panel: "Taxi Panel", login: "Sign In",
        appearance: "Appearance", light: "Light", dark: "Dark", language: "Language", change_language: "Change language", change_theme: "Change theme",
        role_hotel: "Hotel", role_restaurant: "Restaurant", role_recreation: "Recreation", role_taxi: "Taxi Driver", role_translator: "Translator", role_traveler: "Traveler"
      },
      home: {
        hero_title: "Discover the world with", hero_subtitle: "Explore the most exclusive destinations, unforgettable flavors, and immersive AI-powered experiences.",
        search_placeholder: "Search by name, description or city...", distance: "Distance", price: "Price", explore_btn: "Explore",
        no_results: "No results found", back: "Back to Explore", navigate: "Navigate",
        order_taxi: "Order Taxi", hide_taxi: "Hide Taxi", "3d_model": "View 3D Model", virtual_tour: "Virtual Tour", ask_info: "Request Info",
        filters: "Filters", popular: "Popular", any: "Any",
        showing_results: "Showing {{limit}} of {{total}} results.", load_more: "Load more",
        nav_tts: "Calculating route to {{name}}. Distance: {{dist}} kilometers. Estimated time: {{time}} minutes."
      },
      categories: {
        all: "All Destinations", hotel: "Accommodations", restaurant: "Gastronomy", recreation: "Experiences", transport: "Mobility"
      },
      chatbot: {
        placeholder: "Type a message...", send: "Send", start: "Hello! I'm your ViaNova AI assistant. Where do you want to go today?",
        voice_on: "Voice On", voice_off: "Voice Off",
        listening: "Listening...", speaking: "VIANova is speaking...", tap_mic: "Tap the microphone to speak",
        note: "Note", gps_warning: "Automatic GPS on computers may be inaccurate.", auto_gps: "Use Automatic GPS",
        or_manual: "Or enter manually", destination: "Travel destination:",
        error_processing: "There was an error processing your message. Please try again.",
        location_shared: "📍 I have shared my current location.",
        location_received: "Location received.",
        location_error: "Could not access your location. Please check your browser permissions.",
        manual_location: "📍 My location is: {{val}}",
        image_attached: "I have attached a visual reference:",
        image_received: "I received the image. It looks amazing! What would you like to know or find related to this style?",
        image_error: "Could not load the image, the file is invalid or too large.",
        bookings_sent: "Requests sent to all providers!",
        confirm_bookings: "Confirm and Send Bookings"
      },
      comments: {
        title: "Reviews & Comments", your_rating: "Your rating:", placeholder: "Share your experience...",
        submit_btn: "Post comment", submitting: "Submitting...", loading: "Loading comments...", empty: "Be the first to comment.",
        required_title: "Content required", required_desc: "Write a comment before submitting.",
        success_title: "Comment posted", success_desc: "Thanks for your contribution.",
        deleted_title: "Comment deleted", deleted_desc: "Your review has been removed."
      }
    }
  },
  fr: {
    translation: {
      navbar: {
        explore: "Explorer", messages: "Messages", social: "Social", admin: "Admin", business: "Mon Entreprise", taxi: "Mode Taxi", theme: "Thème", profile: "Profil", logout: "Déconnexion",
        settings: "Paramètres du Compte", history: "Historique de Voyages", products: "Mes Produits", taxi_panel: "Panneau Taxi", login: "Connexion",
        appearance: "Apparence", light: "Clair", dark: "Sombre", language: "Langue", change_language: "Changer de langue", change_theme: "Changer de thème",
        role_hotel: "Hôtel", role_restaurant: "Restaurant", role_recreation: "Loisirs", role_taxi: "Chauffeur", role_translator: "Traducteur", role_traveler: "Voyageur"
      },
      home: {
        hero_title: "Découvrez le monde avec", hero_subtitle: "Explorez les destinations les plus exclusives, des saveurs inoubliables et des expériences immersives.",
        search_placeholder: "Rechercher par nom, description ou ville...", distance: "Distance", price: "Prix", explore_btn: "Explorer",
        no_results: "Aucun résultat trouvé", back: "Retour", navigate: "Naviguer",
        order_taxi: "Commander Taxi", hide_taxi: "Cacher Taxi", "3d_model": "Modèle 3D", virtual_tour: "Visite Virtuelle", ask_info: "Demander Info",
        filters: "Filtres", popular: "Populaire", any: "Tous",
        showing_results: "Affichage de {{limit}} sur {{total}} résultats.", load_more: "Voir plus",
        nav_tts: "Calcul de l'itinéraire vers {{name}}. Distance: {{dist}} kilomètres. Temps estimé: {{time}} minutes."
      },
      categories: {
        all: "Toutes les Destinations", hotel: "Hébergement", restaurant: "Gastronomie", recreation: "Expériences", transport: "Mobilité"
      },
      chatbot: {
        placeholder: "Tapez un message...", send: "Envoyer", start: "Bonjour ! Je suis votre assistante IA. Où voulez-vous aller aujourd'hui ?",
        voice_on: "Voix Activée", voice_off: "Voix Désactivée",
        listening: "Écoute en cours...", speaking: "VIANova parle...", tap_mic: "Appuyez sur le micro pour parler",
        note: "Note", gps_warning: "Le GPS automatique sur ordinateur peut être imprécis.", auto_gps: "Utiliser le GPS automatique",
        or_manual: "Ou saisir manuellement", destination: "Destination de voyage :",
        error_processing: "Une erreur s'est produite. Veuillez réessayer.",
        location_shared: "📍 J'ai partagé ma position actuelle.",
        location_received: "Position reçue.",
        location_error: "Impossible d'accéder à votre position. Vérifiez vos autorisations.",
        manual_location: "📍 Ma position est : {{val}}",
        image_attached: "J'ai joint une référence visuelle :",
        image_received: "J'ai reçu l'image. C'est magnifique ! Que souhaitez-vous savoir ou trouver à ce sujet ?",
        image_error: "Impossible de charger l'image, fichier invalide ou trop volumineux.",
        bookings_sent: "Demandes envoyées à tous les fournisseurs !",
        confirm_bookings: "Confirmer et envoyer les réservations"
      },
      comments: {
        title: "Avis et Commentaires", your_rating: "Votre note :", placeholder: "Partagez votre expérience...",
        submit_btn: "Publier", submitting: "Envoi...", loading: "Chargement des commentaires...", empty: "Soyez le premier à commenter.",
        required_title: "Contenu requis", required_desc: "Écrivez un commentaire avant d'envoyer.",
        success_title: "Commentaire publié", success_desc: "Merci pour votre contribution.",
        deleted_title: "Commentaire supprimé", deleted_desc: "Votre avis a été supprimé."
      }
    }
  },
  pt: {
    translation: {
      navbar: {
        explore: "Explorar", messages: "Mensagens", social: "Social", admin: "Admin", business: "Meu Negócio", taxi: "Modo Táxi", theme: "Tema", profile: "Perfil", logout: "Sair",
        settings: "Configurações da Conta", history: "Histórico de Viagens", products: "Meus Produtos", taxi_panel: "Painel do Táxi", login: "Entrar",
        appearance: "Aparência", light: "Claro", dark: "Escuro", language: "Idioma", change_language: "Mudar idioma", change_theme: "Mudar tema",
        role_hotel: "Hotel", role_restaurant: "Restaurante", role_recreation: "Lazer", role_taxi: "Taxista", role_translator: "Tradutor", role_traveler: "Viajante"
      },
      home: {
        hero_title: "Descubra o mundo com", hero_subtitle: "Explore os destinos mais exclusivos, sabores inesquecíveis e experiências imersivas.",
        search_placeholder: "Pesquisar por nome, descrição ou cidade...", distance: "Distância", price: "Preço", explore_btn: "Explorar",
        no_results: "Nenhum resultado", back: "Voltar", navigate: "Ir",
        order_taxi: "Pedir Táxi", hide_taxi: "Ocultar Táxi", "3d_model": "Modelo 3D", virtual_tour: "Tour Virtual", ask_info: "Pedir Informação",
        filters: "Filtros", popular: "Popular", any: "Qualquer",
        showing_results: "Mostrando {{limit}} de {{total}} resultados.", load_more: "Ver mais",
        nav_tts: "Calculando rota para {{name}}. Distância: {{dist}} quilômetros. Tempo estimado: {{time}} minutos."
      },
      categories: {
        all: "Todos", hotel: "Acomodações", restaurant: "Gastronomia", recreation: "Experiências", transport: "Mobilidade"
      },
      chatbot: {
        placeholder: "Digite sua mensagem...", send: "Enviar", start: "Olá! Sou sua assistente IA. Para onde vamos hoje?",
        voice_on: "Voz Ativada", voice_off: "Voz Desativada",
        listening: "Ouvindo...", speaking: "VIANova está falando...", tap_mic: "Toque no microfone para falar",
        note: "Nota", gps_warning: "O GPS automático em computadores pode ser impreciso.", auto_gps: "Usar GPS Automático",
        or_manual: "Ou insira manualmente", destination: "Destino de viagem:",
        error_processing: "Houve um erro ao processar sua mensagem. Tente novamente.",
        location_shared: "📍 Compartilhei minha localização atual.",
        location_received: "Localização recebida.",
        location_error: "Não foi possível acessar sua localização. Verifique as permissões do navegador.",
        manual_location: "📍 Minha localização é: {{val}}",
        image_attached: "Anexei uma referência visual:",
        image_received: "Recebi a imagem. Parece incrível! O que você gostaria de saber ou encontrar relacionado a este estilo?",
        image_error: "Não foi possível carregar a imagem, o arquivo é inválido ou muito grande.",
        bookings_sent: "Solicitações enviadas a todos os fornecedores!",
        confirm_bookings: "Confirmar e Enviar Reservas"
      },
      comments: {
        title: "Avaliações e Comentários", your_rating: "Sua avaliação:", placeholder: "Compartilhe sua experiência...",
        submit_btn: "Publicar comentário", submitting: "Enviando...", loading: "Carregando comentários...", empty: "Seja o primeiro a comentar.",
        required_title: "Conteúdo necessário", required_desc: "Escreva um comentário antes de enviar.",
        success_title: "Comentário publicado", success_desc: "Obrigado pela sua contribuição.",
        deleted_title: "Comentário excluído", deleted_desc: "Sua avaliação foi removida."
      }
    }
  },
  zh: {
    translation: {
      navbar: {
        explore: "探索", messages: "消息", social: "社交", admin: "管理", business: "我的企业", taxi: "出租车", theme: "主题", profile: "个人资料", logout: "注销",
        settings: "账户设置", history: "旅行记录", products: "我的产品", taxi_panel: "出租车面板", login: "登录",
        appearance: "外观", light: "浅色", dark: "深色", language: "语言", change_language: "切换语言", change_theme: "切换主题",
        role_hotel: "酒店", role_restaurant: "餐厅", role_recreation: "娱乐", role_taxi: "司机", role_translator: "翻译", role_traveler: "旅行者"
      },
      home: {
        hero_title: "与探索世界", hero_subtitle: "探索最独特的目的地、难忘的风味和沉浸式体验。",
        search_placeholder: "按名称、描述或城市搜索...", distance: "距离", price: "价格", explore_btn: "探索",
        no_results: "未找到结果", back: "返回", navigate: "导航",
        order_taxi: "叫出租车", hide_taxi: "隐藏", "3d_model": "3D模型", virtual_tour: "虚拟旅游", ask_info: "请求信息",
        filters: "筛选", popular: "流行", any: "任何",
        showing_results: "显示 {{total}} 中的 {{limit}} 个结果。", load_more: "加载更多",
        nav_tts: "正在计算到{{name}}的路线。距离：{{dist}}公里。预计时间：{{time}}分钟。"
      },
      categories: {
        all: "所有目的地", hotel: "住宿", restaurant: "美食", recreation: "体验", transport: "交通"
      },
      chatbot: {
        placeholder: "输入消息...", send: "发送", start: "你好！我是你的AI助手。你今天想去哪里？",
        voice_on: "语音开启", voice_off: "语音关闭",
        listening: "正在聆听...", speaking: "VIANova正在说话...", tap_mic: "点击麦克风开始说话",
        note: "提示", gps_warning: "电脑上的自动GPS可能不准确。", auto_gps: "使用自动GPS",
        or_manual: "或手动输入", destination: "旅行目的地：",
        error_processing: "处理您的消息时出错。请重试。",
        location_shared: "📍 我已分享当前位置。",
        location_received: "已收到位置信息。",
        location_error: "无法访问您的位置。请检查您的浏览器权限。",
        manual_location: "📍 我的位置是：{{val}}",
        image_attached: "我附上了一张视觉参考图：",
        image_received: "我收到了图片。看起来很棒！您想了解或寻找与此风格相关的什么内容？",
        image_error: "无法加载图片，文件无效或太大。",
        bookings_sent: "请求已发送给所有供应商！",
        confirm_bookings: "确认并发送预订"
      },
      comments: {
        title: "评论与评价", your_rating: "你的评分：", placeholder: "分享你的体验...",
        submit_btn: "发布评论", submitting: "提交中...", loading: "加载评论中...", empty: "成为第一个评论的人。",
        required_title: "需要内容", required_desc: "请先写评论再提交。",
        success_title: "评论已发布", success_desc: "感谢你的贡献。",
        deleted_title: "评论已删除", deleted_desc: "你的评价已被移除。"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
