import { readdirSync } from 'node:fs';
import path from 'node:path';

// Expo Router no tiene forma de excluir archivos de `src/app/` de la tabla de rutas: registra
// como ruta todo lo que encuentra ahí, y un archivo de test no tiene export default, así que al
// cargarlo revienta con `ReferenceError: Property 'jest' doesn't exist` y aborta el bundle entero.
//
// Este test no se puede replaced por un filtro de configuración: la única defensa es que el archivo
// no esté en ese directorio. Si vuelve a aparecer uno, el error vuelve con él.

const ROUTER_ROOT = path.resolve(__dirname, '..', '..', 'app');

const ARCHIVO_DE_TEST = /\.(test|spec)\.[jt]sx?$/;
const CARPETA_DE_TEST = ['__tests__', '__mocks__'];

/** Todo lo que hay bajo `src/app/`, con la ruta relativa al directorio como nombre legible. */
function recorrer(ruta: string): string[] {
  return readdirSync(ruta, { withFileTypes: true }).flatMap((entrada) => {
    const completa = path.join(ruta, entrada.name);
    if (entrada.isDirectory()) return recorrer(completa);
    return [path.relative(ROUTER_ROOT, completa).split(path.sep).join('/')];
  });
}

describe('El directorio de rutas de Expo Router (PLAN-74)', () => {
  it('no contiene archivos de test', () => {
    const ofensores = recorrer(ROUTER_ROOT).filter((ruta) => ARCHIVO_DE_TEST.test(ruta));

    expect(ofensores).toEqual([]);
  });

  it('no contiene carpetas __tests__ ni __mocks__', () => {
    const ofensores = recorrer(ROUTER_ROOT).filter((ruta) =>
      ruta.split('/').some((segmento) => CARPETA_DE_TEST.includes(segmento))
    );

    expect(ofensores).toEqual([]);
  });
});
