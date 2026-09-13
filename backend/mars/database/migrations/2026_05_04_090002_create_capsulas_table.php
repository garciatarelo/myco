<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capsulas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->enum('grado', ['minimo', 'medio', 'alto']);
            $table->unsignedInteger('cantidad_micorrizas'); // Cantidad de propágulos / UFC por gramo
            $table->string('unidad_medida')->default('UFC/g');
            $table->string('tipo_hongo')->default('Rhizophagus irregularis');
            $table->float('humedad_suelo_optima_min')->default(20.0);
            $table->float('humedad_suelo_optima_max')->default(100.0);
            $table->float('radio_expansion_estimado_m')->default(1.0);
            $table->float('costo_recurso')->default(1.0); // Costo relativo para optimización de recursos
            $table->text('descripcion')->nullable();
            $table->boolean('activa')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capsulas');
    }
};
