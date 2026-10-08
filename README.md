# WhatsApp Bot

Bot de WhatsApp con reconexión automática, emparejamiento por código de 8 dígitos y sistema de plugins con hot-reload.

## Instalación

```bash
npm install
cp .env.example .env
```

## Configuración

Edita `.env`:

```env
PHONE_NUMBER=5491123456789   # código de país + número, sin +
```

## Uso

### 1. Emparejar (genera código de 8 dígitos)

```bash
npm run pair
```

Aparecerá el código en pantalla. En tu teléfono:

**WhatsApp → Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono**

Ingresa el código. La sesión queda guardada en `./auth`.

### 2. Iniciar el bot

```bash
npm start
```

## Reconexión

- Reintentos con backoff exponencial (2s → 60s máx.)
- 10 reintentos por defecto (configurable en `.env`)
- Si WhatsApp cierra la sesión (`loggedOut`), pedirá re-emparejar
- Si otra sesión reemplaza la conexión, espera 5s y reconecta

## Plugins

Cada plugin es un archivo `.js` en `./plugins/`:

```js
export default {
  name: "ejemplo",
  description: "Descripción del comando",
  commands: ["ejemplo", "e"],
  async execute({ sock, msg, jid, args, text, reply, config }) {
    await reply({ text: `Hola! args: ${args.join(" ")}` });
  },
};
```

- Se recargan automáticamente al guardar el archivo (hot-reload)
- Los archivos que empiezan con `_` o `.` se ignoran
- El objeto `reply` envía respuesta citando el mensaje original

### Plugins incluidos

| Comando | Descripción |
|---------|-------------|
| `!ping` | Verifica latencia |
| `!help` | Lista de comandos |
| `!info` | Info del bot |
| `!sticker` | Imagen → sticker |

## Estructura

```
whatsapp-bot/
├── src/
│   ├── index.js         # Entry point
│   ├── connection.js    # Conexión + reconexión + pairing
│   ├── auth.js          # Estado de autenticación
│   ├── config.js        # Configuración
│   └── pluginLoader.js  # Cargador de plugins
├── plugins/             # Tus plugins
├── auth/                # Sesión (no commitear)
├── .env
└── package.json
```
