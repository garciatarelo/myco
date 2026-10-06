<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('biopolimeros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ruta_id')->constrained('rutas')->onDelete('cascade');
            $table->decimal('latitud_marte', 10, 6);
            $table->decimal('longitud_marte', 10, 6);
            $table->string('tipo_micelio')->default('rhizopus'); // tipo de hongo
            $table->integer('nivel_crecimiento')->default(0); // 0-100%
            $table->integer('humedad_detectada')->nullable(); // %
            $table->integer('toxicidad')->nullable(); // nivel detectado
            $table->timestamp('fecha_siembra');
            $table->timestamp('fecha_cosecha')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biopolimeros');
    }
};
