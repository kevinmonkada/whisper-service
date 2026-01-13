# 📚 **README.md - Whisper Transcription Service**

# 🎤 **Whisper Transcription Service**

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![Whisper.cpp](https://img.shields.io/badge/Whisper.cpp-C++-blue)](https://github.com/ggerganov/whisper.cpp)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Microservicio de transcripción de audio usando Whisper.cpp para workflow de n8n.

**Versión:** 1.0.0  
**Stack:** Node.js 20 + Whisper.cpp + FFmpeg + Express  
**Use case:** Procesar audios de transacciones financieras (Telegram, WhatsApp) para automatización con n8n.

---

## ✨ **Features**

- **Transcripción Offline:** Usa Whisper.cpp para procesamiento local sin APIs externas.
- **Optimizado para Español Financiero:** Prompt especializado para frases como "pagué 50 mil" o "recibí 110000 de Pansi".
- **Procesamiento Inteligente:** Conversión automática WAV, filtros de calidad, limpieza de output.
- **API RESTful:** Endpoint simple para integración con n8n u otros workflows.
- **Configuración Flexible:** Parámetros ajustables (modelo, beam search, temperatura, etc.).
- **Health Checks:** Monitoreo integrado con PM2.

---

## 📋 **Arquitectura**

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   n8n       │────▶│  whisper-service │────▶│   Expense   │
│  Telegram   │     │  (PM2 Port 8000) │     │   Assistant │
│   Webhook   │     │  Whisper.cpp     │     │     LLM     │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ▼
                    [Binary Audio]
                           │
                           ▼
                    1. FFmpeg Conversion
                    2. Audio Filters
                    3. Whisper.cpp OCR
                           │
                           ▼
                    [Structured JSON]
```

---

## 🚀 **Quick Start**

### **1. Instalación inicial**

```bash
# Crear directorio
mkdir -p ~/whisper-service
cd ~/whisper-service

# Clonar repositorio
git clone https://github.com/your-username/whisper-service.git .
npm install

# Descargar modelos de Whisper
cd whisper.cpp/models
bash download-ggml-model.sh base  # o small, medium según necesidad

# Iniciar servicio
npm start
# o con PM2: pm2 start server.js --name whisper-service
```

### **2. Verificar funcionamiento**

```bash
# Health check
curl http://localhost:8000/health

# Test con audio (desde n8n usar localhost:8000/transcribe)
curl -X POST http://localhost:8000/transcribe \
  -F "file=@test.mp3" \
  -F "languages=es"
```

---

## 📦 **Estructura del Proyecto**

```
~/whisper-service/
├── server.js              # Código principal del servicio
├── package.json           # Dependencias npm
├── whisper.cpp/           # Binarios y modelos de Whisper
│   ├── build/bin/
│   │   └── whisper-cli    # Ejecutable de transcripción
│   └── models/            # Modelos GGML (base, small, etc.)
├── uploads/               # Archivos temporales (ignorado en git)
├── .gitignore             # Archivos a ignorar
├── LICENSE                # Licencia MIT
└── README.md              # Esta documentación
```

---

## 🔧 **Comandos Esenciales**

### **Desarrollo**

```bash
cd ~/whisper-service

# Ver logs en tiempo real (con PM2)
pm2 logs whisper-service --lines 20

# Verificar estado
pm2 status

# Health check
curl http://localhost:8000/health

# Test endpoint
curl -X POST http://localhost:8000/transcribe \
  -F "file=@audio.mp3" \
  -F "languages=es" \
  -F "response=direct"
```

### **Modificar configuración**

```bash
# Editar parámetros en server.js
nano server.js

# Cambiar modelo (ejemplo: de base a small)
# WHISPER_MODEL = 'ggml-small.bin';

# Reiniciar servicio
pm2 restart whisper-service
```

### **Gestión de modelos**

```bash
cd whisper.cpp/models

# Descargar modelo base (77MB)
bash download-ggml-model.sh base

# Descargar modelo small (307MB) - mejor precisión
bash download-ggml-model.sh small

# Ver modelos disponibles
ls -lh ggml-*.bin
```

### **Troubleshooting**

```bash
# Ver logs completos
pm2 logs whisper-service

# Ver últimas 50 líneas
pm2 logs whisper-service --lines 50

# Restart rápido
pm2 restart whisper-service

# Ver uso de recursos
pm2 monit whisper-service

# Limpiar archivos temporales
rm -rf uploads/*
```

---

## 🌐 **Endpoint API**

### **POST /transcribe**

**URL:** `http://localhost:8000/transcribe`  
**Método:** `POST`  
**Content-Type:** `multipart/form-data`

**Body Parameters:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `file` | File | ✅ | Archivo de audio (MP3/WAV/M4A/OGG/FLAC/AAC) |
| `languages` | String | ❌ | Idioma (default: "es") |
| `response` | String | ❌ | Modo de respuesta (default: "direct") |

**Response (200 OK):**

```json
[
  {
    "id": "7390db99-06a5-4307-b78a-0b8b040801f3",
    "status": "completed",
    "reference": null,
    "models": "auto",
    "processingTimeInSeconds": 4.16,
    "responseMode": "direct",
    "content": [
      {
        "models": "whisper-cpp-base",
        "text": "pagué 50000 de cuidado de los bebés en efectivo."
      }
    ]
  }
]
```

**Response (500 Error):**

```json
[
  {
    "status": "failed",
    "error": "No audio file received"
  }
]
```

---

## 🔄 **Integración con n8n**

### **HTTP Request Node Config**

```
Method: POST
URL: http://localhost:8000/transcribe
Authentication: None
Response Format: JSON

Body Content Type: Multipart Form Data

Body Parameters:
┌──────────────┬─────────────────────┬────────────────────────┐
│ Parameter    │ Type                │ Value                  │
├──────────────┼─────────────────────┼────────────────────────┤
│ file         │ n8n Binary File     │ data                   │
│ languages    │ Expression          │ es                     │
└──────────────┴─────────────────────┴────────────────────────┘

Options:
- Response: Full Response
- Timeout: 30000 (30s)
```

### **Acceder al output en n8n**

```javascript
// Texto transcrito
{{ $json.body.content.text }}

// Tiempo de procesamiento
{{ $json.body.processingTimeInSeconds }}

// Modelo usado
{{ $json.body.content.models }}

// ID único
{{ $json.body.id }}
```

---

## 📁 **Archivos del Proyecto**

### **1. package.json**

```json
{
  "name": "whisper-service",
  "version": "1.0.0",
  "description": "Servicio de transcripción de audio usando Whisper para integración con n8n",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "fluent-ffmpeg": "^2.1.2",
    "@ffmpeg-installer/ffmpeg": "^1.1.0"
  }
}
```

### **2. server.js (extracto)**

```javascript
// Configuración Whisper.cpp - Optimizada
const WHISPER_MODEL = 'ggml-base.bin';  // base/small/medium
const WHISPER_LANGUAGE = 'es';
const WHISPER_BEAM_SIZE = 4;            // Precisión
const WHISPER_BEST_OF = 3;
const WHISPER_TEMPERATURE = 0.0;        // Determinismo

// Prompt especializado para frases financieras
const WHISPER_PROMPT = `Pansi me dio 110000 en efectivo. Recibí 110000 de Pansi...`;

// Endpoint principal
app.post('/transcribe', upload.any(), (req, res) => {
  // Procesamiento de audio con FFmpeg + Whisper.cpp
  // Retorna JSON compatible con n8n
});
```

---

## 🐛 **Troubleshooting**

### **Error: "too many decoders requested"**

**Causa:** Beam size > 8 no soportado por Whisper.cpp.

```javascript
// Solución: Reducir en server.js
const WHISPER_BEAM_SIZE = 4;  // Máximo 8
```

### **Error: "whisper-cli not found"**

```bash
# Verificar compilación
ls -la whisper.cpp/build/bin/whisper-cli

# Recompilar si necesario
cd whisper.cpp && make clean && make
```

### **Transcripción con baja precisión**

Posibles causas:
- Audio con mucho ruido (activar filtros de audio)
- Modelo tiny/base insuficiente (usar small/medium)
- Prompt genérico (personalizar WHISPER_PROMPT)

```javascript
// Activar filtros de audio en server.js
ffmpegCmd.audioFilters([
  'highpass=f=200',    // Elimina ruido bajo
  'lowpass=f=3000',    // Elimina ruido alto
  'afftdn=nf=-25',     // Reduce ruido ambiente
  'volume=1.5'         // Amplifica señal
]);
```

### **n8n no conecta al servicio**

```bash
# Verificar puerto
netstat -tlnp | grep 8000

# Verificar firewall
sudo ufw status

# Probar conexión directa
curl http://localhost:8000/health
```

### **Archivos temporales acumulados**

```bash
# Limpiar uploads
rm -rf uploads/*

# Verificar espacio
df -h
```

---

## 🔐 **Seguridad**

- ✅ Sin credenciales hardcodeadas
- ✅ Límite de 100MB por archivo de audio
- ✅ Timeout de 5 minutos en procesamiento
- ✅ Limpieza automática de archivos temporales
- ✅ Validación de tipos MIME
- ⚠️ No exponer puerto 8000 públicamente (solo localhost/VPN)

---

## 📊 **Performance**

| Modelo | Tamaño | Velocidad | Precisión | Uso Recomendado |
|---|---|---|---|---|
| Tiny | 39MB | 1-2s | Baja | Testing rápido |
| Base | 77MB | 3-5s | Media | Producción balanceada |
| Small | 307MB | 5-8s | Alta | Máxima precisión |
| Medium | 1.5GB | 10-15s | Muy alta | Crítica financiera |

**Métricas típicas:**
- **Latencia total:** 3-8s según modelo
- **Conversión FFmpeg:** 300-800ms
- **Transcripción Whisper:** 2-7s
- **Memory:** 50-200MB (idle), 300-800MB (processing)
- **CPU:** ~10% (idle), 80-100% (processing)

---

## 🔄 **Actualizaciones**

### **Changelog**

**v1.0.0** (2026-01-13)
- ✅ Primera versión estable
- ✅ Optimización de parámetros para español financiero
- ✅ Filtros de audio opcionales
- ✅ Integración completa con n8n
- ✅ PM2 para gestión de procesos

### **Próximas mejoras**
- 🔄 Soporte para streaming en tiempo real
- 🔄 API de modelos múltiples
- 🔄 Dashboard de métricas
- 🔄 Docker container

---

## 📞 **Soporte**

**Logs importantes:**
```bash
pm2 logs whisper-service 2>&1 | grep -E "ERROR|WARN|❌"
```

**Backup antes de cambios:**
```bash
cp ~/whisper-service/server.js ~/whisper-service/server.js.backup-$(date +%Y%m%d)
```

---

## 🤝 **Contributing**

¡Contribuciones son bienvenidas! Para contribuir:

1. Fork el repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcion`).
3. Commit tus cambios (`git commit -m 'Agrega nueva funcion'`).
4. Push a la rama (`git push origin feature/nueva-funcion`).
5. Abre un Pull Request.

**Guías:**
- Sigue el estilo de código existente.
- Agrega tests si es posible.
- Actualiza el README si cambias la API.

---

## 📄 **License**

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

## 🎯 **Use Cases**

### **1. Automatización Financiera**
- Transcribir audios de Telegram/WhatsApp con transacciones
- Extraer montos, referencias, fechas automáticamente
- Integrar con bases de datos PostgreSQL via n8n

### **2. Asistente de Voz**
- Procesar comandos de voz en español
- Reconocer frases específicas del dominio financiero
- Generar respuestas automáticas

### **3. Análisis de Conversaciones**
- Transcribir reuniones o llamadas
- Extraer insights financieros
- Generar resúmenes automáticos

### **4. Workflow de n8n**
- Trigger: Nuevo audio en Telegram
- Process: Transcripción con Whisper
- Action: Guardar en DB, enviar notificación, etc.

---

**Última actualización:** 2026-01-13  
**Autor:** Whisper Service Team  

---

```json
[{
  "status": "completed",
  "content": [{
    "models": "whisperbase",
    "text": "Texto transcrito aquí"
  }]
}]
```

## Notas

- Modelo usado: `medium` (whisper.cpp, ~15-30s, máxima precisión).
- Soporta archivos de audio comunes (.mp3, .wav, .ogg, .oga, etc.).
- Convierte automáticamente a WAV para Whisper.
- Limite de archivo: 100MB.