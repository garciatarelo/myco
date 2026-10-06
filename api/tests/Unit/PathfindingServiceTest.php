<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\PathfindingService;

class PathfindingServiceTest extends TestCase
{
    public function test_find_path_returns_expected_number_of_points_and_endpoints()
    {
        $pf = new PathfindingService();
        $startLat = -4.6;
        $startLon = 137.4;
        $endLat = -4.59;
        $endLon = 137.41;
        $samples = 10;

        $points = $pf->findPath($startLat, $startLon, $endLat, $endLon, $samples);

        $this->assertIsArray($points);
        $this->assertCount($samples, $points);
        $this->assertEqualsWithDelta($startLat, $points[0]['lat'], 0.001);
        $this->assertEqualsWithDelta($startLon, $points[0]['lon'], 0.001);
        $this->assertEqualsWithDelta($endLat, $points[$samples - 1]['lat'], 0.001);
        $this->assertEqualsWithDelta($endLon, $points[$samples - 1]['lon'], 0.001);
    }
}
