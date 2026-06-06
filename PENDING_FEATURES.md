# Análisis de Características Pendientes por Rol

Este documento detalla las funcionalidades actuales y lo que falta por implementar o mejorar para cada rol en ViaNovaIA.

## 1. Turista (Traveler)
**Actualmente tiene:**
- Feed social (ViaSocial) y mensajería.
- Solicitud de taxis (RequestRide) e historial de viajes.
- Exploración de productos y servicios (ProductStore).

**Qué le falta:**
- **Planificador de Itinerarios:** Una herramienta donde el turista pueda armar su viaje agregando hoteles, restaurantes y actividades por días.
- **Billetera / Wallet:** Visualización de saldo, métodos de pago guardados y cupones de descuento.
- **Mapa Interactivo Global (AR):** Integración de Realidad Aumentada para ver puntos de interés usando la cámara del dispositivo.
- **Reseñas Avanzadas:** Interfaz dedicada para calificar y dejar reseñas con fotos y videos a los servicios consumidos.

## 2. Restaurante (Restaurant)
**Actualmente tiene:**
- Un dashboard MUY avanzado (`RestaurantDashboard.tsx`) con Carta Digital, integración VR/360, vinculación a hoteles (Room Service) y análisis.

**Qué le falta:**
- **Gestor de Mesas (Reservas):** Un mapa interactivo para ver qué mesas están ocupadas y gestionar reservas en tiempo real.
- **Sistema de Punto de Venta (POS):** Integración para imprimir comandas o enviarlas directamente a pantallas de cocina (KDS).
- **Control de Inventario:** Descuento automático de ingredientes por cada plato pedido en la Carta Digital.

## 3. Hotel (Hotel)
**Actualmente tiene:**
- Creación básica de servicio a través del gestor genérico (`MyProducts.tsx`).

**Qué le falta:**
- **Dashboard Dedicado:** Similar al del restaurante, pero enfocado en la gestión de habitaciones.
- **Gestor de Reservas y Calendario (PMS):** Calendario visual para ver ocupación, check-in, check-out y estados de limpieza de las habitaciones.
- **Panel de Integración de Room Service:** Un panel donde el hotel pueda ver los pedidos de restaurantes vinculados que van dirigidos a las habitaciones de sus huéspedes.

## 4. Recreación / Guía (Recreation)
**Actualmente tiene:**
- Gestión de actividades en `MyProducts.tsx` (con campos como duración, capacidad, dificultad, edad mínima).

**Qué le falta:**
- **Dashboard Dedicado:** Con control de grupos, horarios y disponibilidad en vivo.
- **Tickets con Código QR:** Generación de entradas digitales (QR) y un sistema para escanearlas desde la app cuando los turistas llegan.
- **Gestión de Calendario:** Control de reservas por bloques de tiempo.

## 5. Taxista (Taxi)
**Actualmente tiene:**
- Un dashboard avanzado con mapa en tiempo real, viajes activos, ganancias e historial.

**Qué le falta:**
- **Navegación Turn-by-Turn:** Integrar un sistema de ruteo más robusto (como Mapbox Navigation) para guiar al conductor paso a paso.
- **Modo "Heatmap":** Mostrar zonas de la ciudad con alta demanda de turistas en tiempo real para conseguir más viajes.
- **Botón de Pánico / Seguridad:** Conexión directa con central o contactos de emergencia.

## 6. Traductor (Translator)
**Actualmente tiene:**
- Selección de rol en la base de datos, pero sin interfaz dedicada.

**Qué le falta:**
- **Dashboard de Traductor:** Perfil donde pueda definir qué idiomas domina, tarifas por hora o por servicio.
- **Emparejamiento / Llamadas en vivo (Videollamadas):** Integración (por ejemplo usando WebRTC o un servicio como Agora) para que los turistas puedan solicitar traducción instantánea por voz/video.
- **Sistema de Citas:** Agenda para que turistas u hombres de negocios contraten un intérprete para reuniones presenciales.

## 7. Administrador (Admin)
**Actualmente tiene:**
- Un `AdminDashboard` con vista general de usuarios, aprobaciones y finanzas.

**Qué le falta:**
- **Resolución de Disputas:** Sistema de tickets para quejas entre usuarios (ej. el taxista no llegó, el hotel no respetó la reserva).
- **Gestión Avanzada de Contenido:** Panel para moderar publicaciones de ViaSocial y aprobar o rechazar fotos/videos inapropiados.
- **Configuración del Sistema:** Ajuste de comisiones, impuestos y límites de retiro directo desde la interfaz.
