<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terrenos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->foreignId('cliente_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('entorno', ['tierra', 'marte'])->default('tierra');
            $table->decimal('latitud_central', 10, 6)->default(0);
            $table->decimal('longitud_central', 10, 6)->default(0);
            $table->float('dimensiones_m2')->default(10000); // ej. 100x100m
            $table->string('red_wifi_ssid')->default('Myco-Field-WiFi');
            $table->string('red_wifi_pass')->nullable();
            $table->enum('red_wifi_status', ['activa', 'inactiva', 'sin_cobertura'])->default('activa');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terrenos');
    }
};
