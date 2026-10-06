<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('robots', function (Blueprint $table) {
            $table->id();
            $table->string('nombre')->unique();
            $table->string('modelo')->default('Myco-v1');
            $table->string('numero_serie')->nullable();
            $table->foreignId('terreno_id')->nullable()->constrained('terrenos')->nullOnDelete();
            $table->foreignId('estacion_base_id')->nullable()->constrained('estaciones_base')->nullOnDelete();
            $table->enum('estado', ['activo', 'inactivo', 'mantenimiento', 'retornando_base', 'recargando'])->default('activo');
            $table->enum('modo', ['lectura', 'inyeccion'])->default('lectura');
            $table->decimal('latitud_marte', 10, 6)->nullable();
            $table->decimal('longitud_marte', 10, 6)->nullable();
            $table->decimal('latitud', 10, 6)->nullable();
            $table->decimal('longitud', 10, 6)->nullable();
            $table->integer('bateria')->default(100); // 0-100%
            $table->boolean('en_estacion_base')->default(false);
            $table->string('wifi_ssid')->default('Myco-Field-WiFi');
            $table->boolean('wifi_conectado')->default(true);
            $table->string('wifi_ip')->nullable();
            $table->integer('wifi_rssi')->default(-60); // dBm
            $table->integer('capacidad_capsulas')->default(30);
            $table->integer('capsulas_minimo')->default(10);
            $table->integer('capsulas_medio')->default(10);
            $table->integer('capsulas_alto')->default(10);
            $table->json('configuracion')->nullable();
            $table->json('sensores_ir')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('robots');
    }
};
