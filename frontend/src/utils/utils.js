export function planSimulationRoutes(grid, fleetCount) {
  if (!grid || !grid.features) return [];

  // Filter out red and orange points (toxicity >= 0.5)
  const criticalPoints = grid.features
    .filter(f => f.properties.toxicity >= 0.5)
    .map(f => ({
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      toxicity: f.properties.toxicity
    }));

  if (criticalPoints.length === 0) return Array(fleetCount).fill([]);

  // Distribute points among fleet
  const routes = Array.from({ length: fleetCount }, () => []);
  const chunkSize = Math.ceil(criticalPoints.length / fleetCount);
  
  for (let i = 0; i < fleetCount; i++) {
    routes[i] = criticalPoints.slice(i * chunkSize, (i + 1) * chunkSize);
  }

  return routes;
}
