import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    // Eliminamos la línea de "base" porque Laravel maneja sus rutas internamente
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    // Mantenemos esto si ya lo tenías para evitar que el watcher se vuelva loco
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});