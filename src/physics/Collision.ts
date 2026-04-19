export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  points: Point[];
}

/**
 * Простая реализация Separating Axis Theorem (SAT) для проверки
 * пересечения выпуклого многоугольника (машины) с другими полигонами.
 */
export class Collision {
  
  public static checkPolygonCollision(polyA: Polygon, polyB: Polygon): boolean {
    const polygons = [polyA, polyB];
    
    for (let i = 0; i < polygons.length; i++) {
        const polygon = polygons[i];
        for (let j = 0; j < polygon.points.length; j++) {
            const p1 = polygon.points[j];
            const p2 = polygon.points[(j + 1) % polygon.points.length];
            
            // Находим нормаль (ось проекции)
            const normal = { x: p2.y - p1.y, y: p1.x - p2.x };
            
            // Проецируем оба полигона на эту ось
            const minMaxA = this.projectPolygon(normal, polyA);
            const minMaxB = this.projectPolygon(normal, polyB);
            
            // Если проекции не пересекаются, значит полигоны не сталкиваются
            if (minMaxA.max < minMaxB.min || minMaxB.max < minMaxA.min) {
                return false;
            }
        }
    }
    
    // Если на всех осях есть пересечения, полигоны сталкиваются
    return true;
  }

  private static projectPolygon(axis: Point, polygon: Polygon) {
    let min = (polygon.points[0].x * axis.x + polygon.points[0].y * axis.y);
    let max = min;
    
    for (let i = 1; i < polygon.points.length; i++) {
        const p = polygon.points[i];
        const proj = (p.x * axis.x + p.y * axis.y);
        
        if (proj < min) {
            min = proj;
        } else if (proj > max) {
            max = proj;
        }
    }
    
    return { min, max };
  }

  /**
   * Проверка, находится ли машина полностью внутри цели (для победы)
   */
  public static isCarInsideTarget(carPoints: Point[], targetPoints: Point[]): boolean {
    // В упрощенном виде: все 4 точки машины должны лежать внутри прямоугольника цели
    return carPoints.every(cp => this.isPointInPolygon(cp, targetPoints));
  }

  private static isPointInPolygon(point: Point, vs: Point[]): boolean {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  }
}
