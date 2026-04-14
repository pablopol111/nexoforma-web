# NexoForma Web

Proyecto completo listo para subir a GitHub y desplegar en Vercel.

## Qué incluye esta versión
- Acceso por token
- Gestión de cliente local
- Hasta 5 perfiles
- Registro de peso, pasos y comentario
- Gráficas con Recharts
- Exportación de informe Word compatible en .doc

## Ejecución local
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Publicación en Vercel
- Sube todos los archivos a GitHub
- Importa el repositorio en Vercel
- Preset: Vite
- Build command: npm run build
- Output directory: dist

## Cómo actualizar la web
- Edita los archivos en GitHub
- Pulsa Commit changes
- Vercel redepliega automáticamente

## Nota importante
Esta versión sigue siendo frontend con almacenamiento local. Para venderla como SaaS a nutricionistas con panel administrador real, hace falta backend, base de datos y permisos por rol.
