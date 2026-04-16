# PrintNUp

**Imprimí múltiples páginas en una sola hoja A4 — sin backend, sin instalación.**

> Herramienta web 100% client-side para imprimir 2, 3, 4, 6 u 8 páginas por hoja, con detección automática de orientación.

---

## 🚀 Uso rápido

1. Abrí `index.html` en tu navegador (Chrome/Edge recomendado)
2. Elegí cuántas páginas por hoja querés (2, 3, 4, 6 u 8)
3. Subí PDFs o imágenes con el botón **Subir archivos** (o arrastrálas)
4. Ajustá la orientación si lo necesitás
5. Hacé clic en **Imprimir**

---

## 📦 Estructura de archivos

```
print-nup/
├── index.html    ← Estructura HTML
├── styles.css    ← Estilos + CSS de impresión
├── app.js        ← Lógica completa
└── README.md     ← Este archivo
```

---

## ✨ Funcionalidades

- **PDFs**: se procesan página por página con PDF.js (CDN)
- **Imágenes**: JPG, PNG, GIF, WebP, BMP
- **Grillas dinámicas**: 1×2, 2×1, 1×3, 2×2, 2×3, 3×2, 2×4, 4×2
- **Orientación automática**: detecta si las imágenes son verticales u horizontales y elige la hoja óptima
- **Slots vacíos**: botón `+` para agregar contenido a posiciones específicas
- **Drag & drop**: arrastrá archivos al cuerpo de la página o a un slot específico
- **Reemplazar / quitar imagen**: hover sobre cualquier imagen para acceder a las acciones
- **Numeración opcional**: activa la numeración de posiciones
- **Bordes de celda**: activables/desactivables
- **Limpiar todo**: reinicia todos los espacios

---

## 🌐 GitHub Pages

Para publicar en GitHub Pages:

1. Creá un repositorio en GitHub
2. Subí los tres archivos (`index.html`, `styles.css`, `app.js`)
3. En *Settings → Pages*, seleccioná la rama `main` y la carpeta `/root`
4. Tu app estará en `https://tu-usuario.github.io/nombre-repo/`

---

## 🖨️ Notas de impresión

- Se usa `@page { size: A4 portrait/landscape; margin: 6mm; }`
- Las imágenes siempre se escalan proporcionalmente (`object-fit: contain`)
- Funciona mejor en **Chrome** o **Edge** (soporte completo de `@page`)
- En Firefox puede requerir ajustar márgenes manualmente en el diálogo de impresión

---

## 🔧 Dependencias externas (CDN)

Solo una:
- **PDF.js** `3.11.174` — `cdnjs.cloudflare.com`

No requiere Node.js, npm, ni ningún framework.

---

## 📝 Licencia

MIT — libre para uso personal y comercial.
