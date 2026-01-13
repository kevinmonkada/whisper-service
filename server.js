const express = require('express'); // Framework web para crear el servidor HTTP
const multer = require('multer'); // Middleware para manejar archivos multipart/form-data
const ffmpeg = require('fluent-ffmpeg'); // Librería para procesar audio/video con FFmpeg
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg'); // Instala FFmpeg automáticamente
const { exec } = require('child_process'); // Ejecuta comandos del sistema (Whisper)
const fs = require('fs'); // Manejo de archivos del sistema
const os = require('os'); // Información del sistema operativo
const crypto = require('crypto'); // Generación de IDs únicos

ffmpeg.setFfmpegPath(ffmpegInstaller.path); // Configura la ruta de FFmpeg

const app = express(); // Crea la aplicación Express
const PORT = 8000; // Puerto del servidor

// ==========================================
// CONFIGURACIÓN WHISPER.CPP - OPTIMIZADA
// ==========================================

// === MODELO Y LENGUAJE ===
const WHISPER_MODEL = 'ggml-base.bin';  // Opciones: 'ggml-base.bin' (rápido), 'ggml-small.bin' (balance), 'ggml-medium.bin' (preciso)
const WHISPER_LANGUAGE = 'es';           // Opciones: 'es' (español), 'en' (inglés), 'auto' (auto-detect), etc.


// === BEAM SEARCH (Precisión) ===
const WHISPER_BEAM_SIZE = 4;             // Opciones: 1-8 (más alto = mejor precisión, +tiempo; máx 8)
const WHISPER_BEST_OF = 3;               // Opciones: 1-5 (evalúa hipótesis; más alto = mejor, +tiempo)


// === TEMPERATURE (Determinismo) ===
const WHISPER_TEMPERATURE = 0.0;         // Opciones: 0.0-1.0 (0.0 = determinista, 0.1-0.2 = variabilidad)


// === HARDWARE ===
const WHISPER_THREADS = 4;               // Opciones: 1-8 (número de hilos CPU; más = más rápido)


// === FILTROS DE CALIDAD ===
const WHISPER_NO_SPEECH_THOLD = 0.4;     // Opciones: 0.0-1.0 (umbral no-habla; más alto = más estricto)
const WHISPER_ENTROPY_THOLD = 2.4;       // Opciones: 0.0-∞ (umbral entropía; filtra confusión)
const WHISPER_LOGPROB_THOLD = -1.0;      // Opciones: -∞-0 (umbral log-probabilidad; filtra baja confianza)


// === OUTPUT ===
const WHISPER_NO_TIMESTAMPS = true;      // Opciones: true/false (sin timestamps)
const WHISPER_CARRY_INITIAL_PROMPT = false; // Opciones: true/false (mantener prompt en segmentos largos)


// === PROMPT CON CASOS REALES (OPTIMIZADO V2) ===
const WHISPER_PROMPT = `Transferí 250000 a cuenta de ahorros en Davivienda. Recibí 180000 de mi hermana por el cumpleaños. Pagué 95000 en el supermercado Éxito.`;



// === OPCIONES AVANZADAS (Descomentar si necesitás) ===
// const WHISPER_MAX_LEN = 200;          // ❌ NO necesario (audios cortos)
// const WHISPER_PRINT_CONFIDENCE = true; // 🔧 Útil para debugging

// Configuración CORS para permitir requests desde cualquier origen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Parsers para JSON y datos URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crea directorio uploads si no existe
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Configuración de Multer para subir archivos
const upload = multer({ 
  dest: 'uploads/', // Directorio destino
  limits: { fileSize: 100 * 1024 * 1024 } // Límite 100MB
});

// Endpoint principal para transcripción
app.post('/transcribe', upload.any(), (req, res) => {
  console.log('\n📥 ===== NEW REQUEST =====');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('========================\n');

  // Extrae parámetros del request
  let languages = req.body.languages || WHISPER_LANGUAGE; // Idioma (default del config)
  if (languages === 'undefined' || !languages) languages = WHISPER_LANGUAGE; // Fallback
  const responseMode = req.body.response || 'direct'; // Modo de respuesta

  // Busca archivo de audio en los archivos subidos
  let audioFile = null;
  if (req.files && req.files.length > 0) {
    audioFile = req.files.find(f => 
      f.mimetype?.includes('audio') || 
      f.originalname?.match(/\.(mp3|wav|m4a|ogg|oga|flac|aac)$/i)
    ) || req.files[0];
  }

  // Si no hay archivo, retorna error
  if (!audioFile) {
    console.error('❌ No audio file found');
    return res.status(400).json([{
      status: 'failed',
      error: 'No audio file received'
    }]);
  }

  console.log(`✅ Audio file found:`, {
    fieldname: audioFile.fieldname,
    originalname: audioFile.originalname,
    mimetype: audioFile.mimetype,
    size: audioFile.size
  });

  const audioPath = audioFile.path; // Ruta del archivo subido
  const wavPath = audioPath + '.wav'; // Ruta del archivo WAV convertido
  const startTime = Date.now(); // Tiempo inicial para medir duración

  console.log(`🔄 Converting to WAV...`);

  // Convierte audio a WAV usando FFmpeg
  const ffmpegCmd = ffmpeg(audioPath)
    .audioCodec('pcm_s16le') // Codec PCM 16-bit
    .audioFrequency(16000) // 16kHz sample rate
    .audioChannels(1) // Mono

  // 🔧 OPCIONAL: Mejora calidad audio para audios ruidosos (ej. Telegram)
  // Descomenta si los audios tienen mucho ruido de fondo
  ffmpegCmd.audioFilters([
     'highpass=f=200',        // Elimina ruido bajo (< 200Hz)
     'lowpass=f=3000',        // Elimina ruido alto (> 3kHz, preserva voz)
     'afftdn=nf=-25',         // Denoise con FFT (reduce ruido ambiente)
     'volume=1.5'             // Amplifica volumen 50% (mejora señal débil)
   ]);

  ffmpegCmd
    .output(wavPath)
    .on('start', (cmd) => {
      console.log('🎬 FFmpeg:', cmd);
    })
    .on('end', () => {
      console.log('✅ Conversion complete → Starting Whisper');

      // Comando para ejecutar Whisper.cpp (orden correcto de parámetros)
      let whisperCmd = `/home/ubuntu/whisper-service/whisper.cpp/build/bin/whisper-cli -m /home/ubuntu/whisper-service/whisper.cpp/models/${WHISPER_MODEL} -f "${wavPath}" -l ${WHISPER_LANGUAGE} --temperature ${WHISPER_TEMPERATURE} --threads ${WHISPER_THREADS}`;
      // Agrega beam search (antes del prompt)
      if (typeof WHISPER_BEST_OF !== 'undefined') whisperCmd += ` --best-of ${WHISPER_BEST_OF}`;
      if (typeof WHISPER_BEAM_SIZE !== 'undefined') whisperCmd += ` --beam-size ${WHISPER_BEAM_SIZE}`;
      // Filtros de calidad
      if (typeof WHISPER_NO_SPEECH_THOLD !== 'undefined') whisperCmd += ` --no-speech-thold ${WHISPER_NO_SPEECH_THOLD}`;
      if (typeof WHISPER_ENTROPY_THOLD !== 'undefined') whisperCmd += ` --entropy-thold ${WHISPER_ENTROPY_THOLD}`;
      if (typeof WHISPER_LOGPROB_THOLD !== 'undefined') whisperCmd += ` --logprob-thold ${WHISPER_LOGPROB_THOLD}`;
      // Output options
      if (typeof WHISPER_MAX_LEN !== 'undefined') whisperCmd += ` --max-len ${WHISPER_MAX_LEN}`;
      if (typeof WHISPER_NO_TIMESTAMPS !== 'undefined' && WHISPER_NO_TIMESTAMPS) whisperCmd += ' --no-timestamps';
      // Prompt al final (escapado)
      whisperCmd += ` --prompt ${JSON.stringify(WHISPER_PROMPT)}`;
      // Carry initial prompt
      if (typeof WHISPER_CARRY_INITIAL_PROMPT !== 'undefined' && WHISPER_CARRY_INITIAL_PROMPT) whisperCmd += ' --carry-initial-prompt';
      console.log('🎤 Whisper.cpp:', whisperCmd);

      // Ejecuta Whisper
      exec(whisperCmd, { 
        timeout: 300000, // 5 minutos timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (err, stdout, stderr) => {
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
        // Limpia archivos temporales
        fs.unlink(audioPath, () => {});
        fs.unlink(wavPath, () => {});

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        if (err) {
          console.error('❌ Whisper error:', err.message);
          console.error('stderr:', stderr);
          return res.json([{
            status: 'failed',
            error: stderr || err.message
          }]);
        }

        // Procesa el output de Whisper
        const text = stdout.trim();
        const cleanText = text.trim().toLowerCase();

        console.log(`✅ SUCCESS (${processingTime}s):`);
        console.log(`   "${text.substring(0, 150)}..."`);
        console.log('========================\n');

        // Respuesta JSON en formato esperado por n8n
        res.json([{
          id: crypto.randomUUID(), // ID único
          status: 'completed',
          reference: null,
          models: 'auto', // Modelo usado (para compatibilidad)
          processingTimeInSeconds: parseFloat(processingTime),
          responseMode,
          content: [{
            models: `whisper-cpp-${WHISPER_MODEL.replace('ggml-', '').replace('.bin', '')}`, // Modelo usado dinámicamente
            text: cleanText // Texto transcrito limpio
          }]
        }]);
      });
    })
    .on('error', (err) => {
      console.error('❌ FFmpeg error:', err.message);
      fs.unlink(audioPath, () => {});
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json([{
        status: 'failed',
        error: err.message
      }]);
    })
    .run(); // Ejecuta la conversión
});

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    whisper: 'ready'
  });
});

// Inicia el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 WHISPER TRANSCRIPTION SERVER`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n📡 Available on:`);
  console.log(`   http://localhost:${PORT}/transcribe`);
  
  console.log(`\n✅ n8n Config:`);
  console.log(`   URL: http://localhost:${PORT}/transcribe`);
  console.log(`   Method: POST`);
  console.log(`   Body: Form-Data`);
  console.log(`   Binary Field: "file" (or any name)`);
  console.log(`\n📊 Health check:`);
  console.log(`   http://localhost:${PORT}/health`);
  console.log(`\n${'='.repeat(50)}\n`);
});

// Manejo de errores del servidor
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});