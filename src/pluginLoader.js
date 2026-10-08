import { readdir, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";

const plugins = new Map();
const watchers = new Map();

export function getPlugins() {
  return plugins;
}

export function findPlugin(command) {
  for (const plugin of plugins.values()) {
    if (plugin.commands?.includes(command)) return plugin;
  }
  return null;
}

export async function loadPlugin(filePath) {
  try {
    const url = pathToFileURL(filePath).href;
    const mod = await import(`${url}?t=${Date.now()}`);
    const plugin = mod.default;

    if (!plugin || !plugin.commands || typeof plugin.execute !== "function") {
      console.warn(`[plugins] Formato inválido: ${filePath}`);
      return false;
    }

    const id = path.basename(filePath);
    for (const cmd of plugin.commands) {
      for (const [existingId, existing] of plugins) {
        if (existing.commands.includes(cmd) && existingId !== id) {
          console.warn(`[plugins] Comando "${cmd}" duplicado en ${id} (ignorado, ya usado por ${existingId})`);
          return false;
        }
      }
    }

    plugins.set(id, plugin);
    console.log(`[plugins] Cargado: ${plugin.name || id} (${plugin.commands.join(", ")})`);
    return true;
  } catch (err) {
    console.error(`[plugins] Error cargando ${filePath}:`, err.message);
    return false;
  }
}

export async function unloadPlugin(id) {
  const plugin = plugins.get(id);
  if (!plugin) return false;
  if (typeof plugin.onUnload === "function") {
    try {
      plugin.onUnload();
    } catch (err) {
      console.error(`[plugins] Error en onUnload de ${id}:`, err.message);
    }
  }
  plugins.delete(id);
  console.log(`[plugins] Descargado: ${id}`);
  return true;
}

export async function loadAllPlugins() {
  const dir = path.resolve(config.pluginsDir);

  try {
    await stat(dir);
  } catch {
    console.warn(`[plugins] Directorio no encontrado: ${dir}`);
    return;
  }

  const files = (await readdir(dir)).filter(
    (f) => f.endsWith(".js") && !f.startsWith("_") && !f.startsWith(".")
  );

  for (const file of files) {
    await loadPlugin(path.join(dir, file));
  }

  console.log(`[plugins] ${plugins.size} plugin(s) cargado(s)`);
}

export function watchPlugins() {
  const dir = path.resolve(config.pluginsDir);
  let debounce = null;

  const watcher = watch(dir, async (eventType, filename) => {
    if (!filename || !filename.endsWith(".js") || filename.startsWith("_")) return;

    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const filePath = path.join(dir, filename);
      const id = filename;

      try {
        await stat(filePath);
        if (plugins.has(id)) await unloadPlugin(id);
        await loadPlugin(filePath);
      } catch {
        if (plugins.has(id)) await unloadPlugin(id);
      }
    }, 300);
  });

  watchers.set(dir, watcher);
  console.log(`[plugins] Observando cambios en: ${dir}`);
}

export function stopWatchingPlugins() {
  for (const w of watchers.values()) w.close();
  watchers.clear();
}
