import Navbar from "@/components/Navbar";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-12 mt-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad y Términos</h1>
          <p className="text-sm text-muted-foreground">Última actualización: 20 de octubre de 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Responsable del tratamiento</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            VIANova es una plataforma de turismo que conecta viajeros con proveedores de servicios
            (hoteles, restaurantes, recreación, transporte y traductores). Los datos se tratan conforme
            a la Ley 1581 de 2012 de Colombia y, cuando aplique, al Reglamento General de Protección de
            Datos (GDPR) de la Unión Europea.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Datos que recopilamos</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-muted-foreground space-y-1">
            <li>Datos de cuenta: nombre, usuario, correo electrónico y contraseña cifrada.</li>
            <li>Datos de perfil: foto, biografía, roles y actividad en la plataforma.</li>
            <li>Datos de uso: publicaciones, comentarios, mensajes y calificaciones.</li>
            <li>Datos de ubicación aproximada cuando el usuario autoriza el permiso del navegador.</li>
            <li>Datos de pago gestionados por proveedores certificados; no almacenamos números de tarjeta.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Finalidades</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Usamos los datos para prestar los servicios de la plataforma, autenticar sesiones, procesar
            reservas y pagos, enviar notificaciones relacionadas con el servicio, prevenir fraudes y
            cumplir obligaciones legales. No vendemos datos personales a terceros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Seguridad</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Las sesiones usan cookies HTTPOnly con SameSite y cifrado en tránsito mediante HTTPS/HSTS.
            Las contraseñas se almacenan con bcrypt. Aplicamos límites de intentos de acceso, bloqueo
            temporal y validación de entradas para reducir riesgos de seguridad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Derechos del usuario</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Puedes acceder, actualizar o eliminar tu cuenta y tus datos desde Configuración de cuenta.
            La eliminación de cuenta borra publicaciones, mensajes, relaciones sociales y datos de perfil.
            También puedes solicitar información sobre el tratamiento escribiendo al correo de soporte
            registrado en la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Retención</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Conservamos los datos mientras la cuenta esté activa o sea necesario para cumplir obligaciones
            legales. Los códigos de recuperación de contraseña expiran en 15 minutos y son de un solo uso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Contacto</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Para ejercer tus derechos o presentar una reclamación, contacta al equipo de VIANova a través
            de los canales oficiales del proyecto.
          </p>
        </section>
      </main>
    </div>
  );
}
