import * as posenet from '@tensorflow-models/posenet';
import _ from "lodash";
import { drawCircle, drawPolyline } from "./canvasHelper";

const imagescaleFactor = 0.5;
const flipHorizontal = false;
const outputStride = 16;

const bodyIds = [5, 6, 11, 12];
const leftArmsId = [5, 7, 9];
const rightArmsId = [6, 8, 10];

class EstimatePoseFromImage {
  constructor() {
    this._canEstimate = false;
  }

  init() {
    this._canvas = document.querySelector("#canvas");
    this._canvas.width = 564;
    this._canvas.height = 564;
    this._ctx = canvas.getContext("2d");
  }

  async _estimatePoseOnImage() {
    console.log("load開始");
    const imageElement = document.querySelector("#image");

    this._canEstimate = true;
    const net = await posenet.load();

    const pose = await net.estimateSinglePose(
      imageElement,
      imagescaleFactor,
      flipHorizontal,
      outputStride
    );

    console.log("load終わり");

    return pose;
  }

  async renderCanvas() {
    const pose = await this._estimatePoseOnImage();

    if (!this._canEstimate) return;

    console.log(pose);
    _.each(pose.keypoints, point => {
      drawCircle(this._ctx, point.position.x, point.position.y);
    });

    const bodyArray = _.filter(pose.keypoints, (point, index) =>
      _.includes(bodyIds, index)
    );
    const rightArmArray = _.filter(pose.keypoints, (point, index) =>
      _.includes(rightArmsId, index)
    );
    const leftArmArray = _.filter(pose.keypoints, (point, index) =>
      _.includes(leftArmsId, index)
    );

    drawPolyline(this._ctx, bodyArray);
    drawPolyline(this._ctx, rightArmArray);
    drawPolyline(this._ctx, leftArmArray);
  }

  clearCanvas() {
    this._canEstimate = false;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }
}

export default new EstimatePoseFromImage();
