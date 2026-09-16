// Preset de Expo: entiende las transformaciones de React Native y de los módulos de Expo,
// que un jest común no sabe procesar.
//
// El preset se deja intacto a propósito. Acotar `roots` o reescribir `transformIgnorePatterns`
// deja al runtime de Expo fuera del alcance de módulos de jest y los tests fallan al arrancar
// con "trying to import a file outside of the scope of the test code".
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
