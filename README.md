# SpaceDisk

Analizador de espacio en disco para Windows, con dashboard web local, en TypeScript.

SpaceDisk muestra el uso de cada unidad y analiza discos o carpetas para responder una pregunta concreta: **¿qué archivos y carpetas están ocupando el espacio?**

![SpaceDisk](assets/icon.svg)

## Características

- Panel de unidades con espacio total, usado y libre, con dona y barra de uso.
- Análisis de discos completos o de carpetas concretas.
- Selector de carpetas integrado, sin escribir rutas a mano.
- Progreso en vivo mediante Server-Sent Events: archivos, carpetas, datos leídos, errores y ruta actual.
- Cancelación de análisis.
- Ranking de los **1.000 archivos más grandes** con:
  - búsqueda por nombre o ruta;
  - filtro por tamaño mínimo y extensión;
  - orden por tamaño, fecha o nombre;
  - apertura de la ubicación en Explorer y copia de ruta.
- Explorador de carpetas con tamaños agregados.
- **Treemap** sincronizado con el explorador de carpetas.
- Resumen de espacio por categoría y por extensión.
- Errores de permisos reportados sin detener el análisis.
- Interfaz en **español e inglés**, tema **oscuro y claro**.
- Ejecutable portable único, sin necesidad de instalar Node.

## Requisitos

### Para usar el ejecutable

- Windows 10 u 11 de 64 bits.
- No requiere Node.js.

### Para desarrollar

- **Node.js 26 LTS** o superior.
- npm.

Comprobación:

```powershell
node --version
npm --version
```

El proyecto se desarrolló y verificó con Node 26.12.1. El empaquetado usa `node --build-sea`.

## Inicio rápido

La forma más sencilla es hacer doble clic en:

```text
init.bat
```

El lanzador:

- reutiliza la instancia si SpaceDisk ya está en ejecución y abre el navegador;
- comprueba que Node.js 26 LTS esté disponible;
- instala las dependencias si falta `node_modules`;
- compila el frontend y el servidor;
- busca un puerto libre desde el 3001;
- inicia el servidor en una ventana llamada **SpaceDisk Server**;
- abre el navegador automáticamente.

Para detener la aplicación, cierra la ventana **SpaceDisk Server**. Si ya está en ejecución y quieres aplicar cambios de código, cierra primero esa ventana y vuelve a ejecutar `init.bat`. Si Node.js no está disponible, `init.bat` intenta usar `release\SpaceDisk.exe`.

### Modo desarrollo manual

```powershell
npm install
npm run dev
```

- Dashboard de desarrollo: <http://127.0.0.1:5173>
- API local: <http://127.0.0.1:3001>

Vite hace proxy de `/api` hacia el servidor Node.

## Uso local sin modo desarrollo

```powershell
npm run build
npm start
```

Abre <http://127.0.0.1:3001>. El servidor sirve la interfaz compilada y la API desde el mismo puerto.

## Ejecutable portable

```powershell
npm run build:exe
```

Genera:

```text
release/SpaceDisk.exe
```

Es un único ejecutable de unos **103 MB** que incluye el runtime de Node, el servidor y todos los assets de la interfaz.

Al ejecutarlo:

- inicia el servidor local;
- abre el navegador automáticamente;
- si el puerto 3001 está ocupado, prueba los siguientes;
- muestra una consola; al cerrarla se detiene la aplicación.

> El ejecutable no está firmado digitalmente. Windows SmartScreen puede mostrar una advertencia la primera vez. Usa "Más información" → "Ejecutar de todas formas" si confías en el archivo.

## Pruebas

```powershell
npm test          # pruebas del núcleo y de la API
npm run typecheck # TypeScript estricto, servidor y web
npm run test:exe  # smoke test del ejecutable portable
```

`test:exe` requiere haber ejecutado antes `npm run build:exe`. Arranca el `.exe` en un puerto libre, comprueba los assets embebidos, las unidades, un escaneo real y lo cierra.

## Cómo funciona el análisis

- Recorre las carpetas con `fs.opendir` y obtiene el tamaño de cada archivo con `lstat`.
- Limita la concurrencia para no saturar el disco.
- Omite symlinks, junctions y reparse points para evitar bucles.
- Calcula los tamaños de carpeta de abajo hacia arriba.
- Mantiene en memoria:
  - el árbol de carpetas y sus totales;
  - los 1.000 archivos más grandes;
  - totales por categoría y por extensión;
  - hasta 50 errores de acceso.
- Al cancelar, descarta los resultados parciales para no mostrar totales engañosos.
- Solo se ejecuta un análisis a la vez. Si se inicia otro, se pide confirmación y se reemplaza el anterior.

### Exclusiones y filtros

Las **exclusiones** y la **profundidad máxima** afectan al alcance del análisis:

- Carpetas del sistema (activado por defecto al analizar una unidad):
  - `Windows`
  - `$Recycle.Bin`
  - `System Volume Information`
  - `Recovery`
- Presets opcionales: `node_modules`, `.git`, carpetas de build, cachés y temporales.
- Patrones glob personalizados, separados por líneas o comas.

El **tamaño mínimo**, las **extensiones**, la **búsqueda** y el **filtro por carpeta** solo afectan al ranking mostrado. Los totales de carpetas y categorías siempre reflejan todo lo analizado.

El ranking se calcula sobre los 1.000 archivos más grandes para mantener bajo el uso de memoria. El selector permite mostrar 50, 100 o 500.

## Estructura

```text
SpaceDisk/
├─ assets/               # icono SVG/ICO
├─ shared/               # tipos, categorías y presets compartidos
├─ server/
│  ├─ src/core/          # scanner, consultas, volúmenes, gestor de escaneos
│  ├─ src/routes/        # API REST y SSE
│  ├─ src/app.ts         # aplicación Express
│  └─ tests/             # Vitest + Supertest
├─ web/
│  ├─ src/components/    # dashboard React
│  ├─ src/hooks/         # volúmenes, escaneo, tema
│  ├─ src/i18n/          # español e inglés
│  └─ src/styles.css
├─ scripts/              # builds, icono y smoke test
├─ dist/                 # build web + servidor (generado)
├─ release/              # SpaceDisk.exe (generado)
└─ README.md
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servidor |
| `GET` | `/api/volumes` | Unidades y espacio |
| `GET` | `/api/fs/dirs?path=...` | Navegador de carpetas |
| `POST` | `/api/scans` | Inicia un análisis |
| `GET` | `/api/scans/:id` | Estado y resumen |
| `GET` | `/api/scans/:id/events` | Progreso SSE |
| `GET` | `/api/scans/:id/files` | Ranking de archivos |
| `GET` | `/api/scans/:id/dirs` | Hijos de una carpeta |
| `GET` | `/api/scans/:id/summary` | Resumen del análisis |
| `POST` | `/api/scans/:id/cancel` | Cancela |
| `POST` | `/api/scans/:id/reveal` | Abre la ubicación en Explorer |

Ejemplo de análisis:

```powershell
$body = @{
  root = "C:\Users\USUARIO\Downloads"
  excludePatterns = @("**/node_modules/**")
  excludeSystemDirs = $true
  maxDepth = $null
  replace = $false
} | ConvertTo-Json

$job = Invoke-RestMethod http://127.0.0.1:3001/api/scans `
  -Method Post -ContentType "application/json" -Body $body

Invoke-RestMethod "http://127.0.0.1:3001/api/scans/$($job.id)"
```

## Seguridad y privacidad

- El servidor escucha **solo en `127.0.0.1`**.
- No hay autenticación porque es una herramienta local de un solo usuario.
- La aplicación es de **solo lectura**: no borra, mueve ni modifica archivos.
- Los navegadores no pueden leer rutas arbitrarias; el servidor expone únicamente nombres de carpetas, rutas y tamaños.
- "Mostrar en Explorer" valida que la ruta pertenezca al análisis actual.
- No hay telemetría ni conexiones salientes.
- Las preferencias (idioma, tema, última ruta y filtros) se guardan en `localStorage`.

## Limitaciones conocidas

- **Enlaces duros**: Windows puede contarlas dos veces (por ejemplo, en `C:\Windows`). Esa carpeta se excluye por defecto al analizar una unidad completa.
- **Permisos**: las rutas sin acceso se omiten y se reportan; ejecutar como administrador aumenta la cobertura.
- **Velocidad**: el recorrido con Node es más lento que herramientas que leen la MFT de NTFS, como WizTree. Para discos completos conviene usar los filtros y tener paciencia.
- **Unidades virtuales o de red** (Google Drive, unidades mapeadas): pueden tardar mucho más.
- **Resultados parciales**: al cancelar no se conservan.
- **Sin historial**: los resultados se pierden al cerrar el servidor. Recargar la página mientras el servidor sigue activo reconecta al análisis.
- **Sin borrado**: la app no elimina archivos desde la interfaz.
- **Solo Windows**: la detección de volúmenes y el empaquetado están orientados a Windows.
- **Límite de seguridad**: 1.000.000 de carpetas por análisis.
- **Ranuras de archivos**: se conservan los 1.000 más grandes, no un índice de todos los archivos.

## Solución de problemas

### El puerto 3001 está ocupado

En desarrollo, cierra el proceso que lo usa. El ejecutable portable busca automáticamente otro puerto.

### No se detectan las unidades

SpaceDisk consulta `Win32_LogicalDisk` con PowerShell y, si falla, usa `fs.statfs` como respaldo. Comprueba que PowerShell esté disponible:

```powershell
Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace
```

### Node demasiado antiguo

El proyecto requiere Node 26. Si `node --version` muestra una versión anterior, actualiza desde <https://nodejs.org/>. Para `build:exe` se necesita una versión reciente de Node 26 con `--build-sea`.

### SmartScreen bloquea el ejecutable

Es normal en ejecutables sin firma. Solo ejecútalo si lo compilaste tú o confías en la fuente.

## Licencia

Proyecto personal de ejemplo. Añade una licencia explícita si vas a publicarlo o distribuirlo.
