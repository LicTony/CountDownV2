# AGENTS.md — Instrucciones para Agentes de Código

## Versionado Obligatorio

**Antes de cada commit, la versión del proyecto DEBE actualizarse.**

### Ubicación de la versión

La versión está definida en **dos lugares** que deben mantenerse sincronizados:

1. `index.html` → `<meta name="version" content="X.Y.Z" />`
2. `app.js` → `const APP_VERSION = 'X.Y.Z';`

### Esquema semver

- **X** (major): cambios grandes, breaking changes
- **Y** (minor): features nuevos, mejoras funcionales
- **Z** (patch): fixes de bugs, correcciones menores

### Reglas

| Cambio | Acción |
|--------|--------|
| Fix de bug (ej: parser CSV) | Incrementar **patch** (1.0.0 → 1.0.1) |
| Feature nuevo (ej: filtros) | Incrementar **minor** (1.0.0 → 1.1.0) |
| Cambio grande / breaking | Incrementar **major** (1.0.0 → 2.0.0) |

### Ejemplo de flujo

```
1. Modificar app.js o index.html
2. Actualizar versión en AMBOS archivos
3. git add .
4. git commit -m "feat: agregar filtro por día (v1.2.0)"
5. git push
```

### Commit messages

Usar convención de mensajes con la versión al final:

- `fix: parser CSV soporta comas (v1.1.1)`
- `feat: agregar filtro por día (v1.2.0)`
- `chore: actualizar dependencias (v1.2.1)`
