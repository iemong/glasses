export const drawCircle = (context, x, y) => {
  context.beginPath();
  context.arc(x, y, 5, 0, (360 * Math.PI) / 180, false);
  context.fillStyle = "rgba(255,0,0,0.8)";
  context.fill();
};

export const drawPolyline = (context, points) => {
  context.beginPath();
  _.each(points, (point, index) => {
    if (index === 0) {
      context.moveTo(point.position.x, point.position.y);
    } else {
      context.lineTo(point.position.x, point.position.y);
    }
  });
  context.strokeStyle = "rgba(255,0,0,0.8)";
  context.stroke();
};
