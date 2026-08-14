# VIANova - Plataforma Inteligente de Turismo y Viajes

## 📌 Descripción del Proyecto

**VIANova** es una plataforma web moderna e inteligente para descubrir, explorar y planificar viajes. Combina tecnología de IA, visualización interactiva en 3D/VR, mapas interactivos y un asistente virtual para proporcionar una experiencia de turismo inmersiva y personalizada.

La plataforma permite a los usuarios:
- 🤖 Consultar un chatbot IA para obtener recomendaciones de viajes
- 🗺️ Explorar destinos en mapas interactivos
- 🏨 Descubrir atracciones categorizadas (hoteles, comidas, actividades, transporte)
- 👓 Ver previsualizaciones en VR de los destinos
- 💬 Compartir comentarios y experiencias con otros viajeros
- 👤 Gestionar perfil y preferencias personalizadas

## 🛠️ Stack Tecnológico

### Frontend
- **React 19** con TypeScript
- **Vite** como bundler y dev server
- **TailwindCSS** para estilos
- **Radix UI** como componentes base accesibles
- **React Three Fiber** para visualización 3D/VR
- **Leaflet** para mapas interactivos
- **React Query** para gestión de datos
- **Framer Motion** para animaciones
- **Wouter** para enrutamiento ligero
- **React Hook Form** para formularios

### Backend
- **Node.js con TypeScript**
- **Express** como framework web
- **Drizzle ORM** para gestión de base de datos
- **PostgreSQL** como base de datos principal
- **Neon Database** para serverless PostgreSQL

### Herramientas
- **tsx** para ejecución de TypeScript
- **Drizzle Kit** para migraciones de BD
- **Zod** para validación de esquemas

## 📁 Estructura del Proyecto

```
ViaNovaIA/
├── client/                  # Frontend React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/          # Páginas principales
│   │   ├── lib/            # Utilidades y configuración
│   │   ├── data/           # Datos mock
│   │   ├── hooks/          # Hooks personalizados
│   │   └── ui/             # Componentes UI base
│   └── index.html
├── server/                  # Backend Express
│   ├── index.ts            # Punto de entrada
│   ├── routes.ts           # Rutas API
│   └── storage.ts          # Gestión de almacenamiento
├── shared/                  # Código compartido
│   └── schema.ts           # Esquemas de BD con Drizzle
├── script/                  # Scripts auxiliares
└── package.json            # Dependencias del proyecto
```

## 🎯 Características Principales

### 1. **Chatbot Inteligente (VIANova)**
- Asistente virtual para recomendaciones de viajes
- Soporte multimodal con texto e imágenes
- Historial de conversaciones por usuario
- Respuestas contextuales basadas en ubicación

### 2. **Mapa Interactivo**
- Visualización de destinos y atracciones
- Geolocalización de usuarios
- Filtrado por categorías
- Información detallada de ubicaciones

### 3. **Galería de Experiencias en VR**
- Previsualizaciones en 3D de destinos
- Visor integrado de realidad virtual
- Experiencias inmersivas sin necesidad de casco

### 4. **Sistema de Reseñas y Comentarios**
- Comentarios basados en ubicaciones
- Puntuaciones de experiencias
- Comunidad de viajeros

### 5. **Panel de Proveedor**
- Gestión de contenido turístico
- Control de media (imágenes y videos)
- Análisis de interacciones

### 6. **Autenticación y Perfiles**
- Registro y login de usuarios
- Perfiles personalizables
- Preferencias de viaje

## 📊 Modelo de Datos

- **Usuarios**: Gestión de perfiles y autenticación
- **Conversaciones**: Historial de chats con el IA
- **Mensajes**: Conversaciones detalladas
- **Media**: Gestión de imágenes y videos de atracciones
- **Categorías**: Hoteles, Comidas, Actividades, Transporte, Otros

## 🚀 Instalación y Uso

### Requisitos Previos
- Node.js 18+
- npm o yarn
- PostgreSQL (o Neon Database configurada)

### Instalación

```bash
# Clonar el repositorio
git clone <repositorio>
cd ViaNovaIA

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de BD y servicios

# Ejecutar migraciones de BD
npm run db:push
```

### Desarrollo

```bash
# Iniciar servidor backend (puerto 3000)
npm run dev

# En otra terminal, iniciar cliente frontend (puerto 5000)
npm run dev:client
```

Accesa a:
- Frontend: http://localhost:5000
- API: http://localhost:3000

### Producción

```bash
# Compilar proyecto
npm run build

# Iniciar en producción
npm start
```

## 🔗 Rutas Principales

| Ruta | Descripción |
|------|-------------|
| `/` | Página de inicio con mapa y atracciones |
| `/login` | Autenticación de usuarios |
| `/provider-dashboard` | Panel de gestión para proveedores |

## 🔑 Variables de Entorno

```env
DATABASE_URL=postgresql://...
NODE_ENV=development|production
VITE_API_URL=http://localhost:3000
```

## 📝 Scripts Disponibles

- `npm run dev` - Inicia servidor backend en desarrollo
- `npm run dev:client` - Inicia cliente frontend en desarrollo
- `npm run build` - Compila para producción
- `npm run start` - Inicia servidor en producción
- `npm run check` - Verifica tipos TypeScript
- `npm run db:push` - Sincroniza cambios de esquema a BD

## 🎨 Componentes Principales

- **Navbar**: Navegación principal
- **Chatbot**: Asistente inteligente flotante
- **MapView**: Visualización de mapa con atracciones
- **CardItem**: Tarjeta de información de atracción
- **VRViewer**: Visor de experiencias 3D/VR
- **Comments**: Sistema de comentarios y reseñas
- **ProviderDashboard**: Panel de administración

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👨‍💻 Autor

Proyecto desarrollado con TypeScript, React y Node.js.

---

**VIANova** - Tu conserje inteligente para descubrir el mundo 🌍✈️
