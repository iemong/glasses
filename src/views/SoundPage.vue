<template lang="pug">
  .sound
    video#video(ref="video")
    canvas#canvas(ref="canvas")
    .circle
</template>

<script>
  import * as posenet from '@tensorflow-models/posenet';
  import _ from "lodash";
  import {Howl, Howler} from 'howler';
  import dat from "dat.gui";
  import Stats from "stats.js";
  import { preloadImage } from "../lib/imageHelper";
  import glasses from "@/assets/glasses.png";
  import se from "@/assets/se.mp3";

  /*======================================
  const
  =======================================*/

  // stats
  const stats = new Stats();

  // video size
  const videoWidth = 800;
  const videoHeight = 600;

  // gui
  const guiState = {
    algorithm: "single-pose",
    input: {
      mobileNetArchitecture: "0.75",
      outputStride: 16,
      imageScaleFactor: 0.5
    },
    singlePoseDetection: {
      minPoseConfidence: 0.1,
      minPartConfidence: 0.5
    },
    multiPoseDetection: {
      maxPoseDetections: 5,
      minPoseConfidence: 0.15,
      minPartConfidence: 0.1,
      nmsRadius: 30.0
    },
    output: {
      showVideo: true,
      showSkeleton: true,
      showPoints: true
    },
    net: null
  };
  // sound
  const sound = new Howl({
    src: [se]
  });

  export default {
    name: "sound",

    /*======================================
    data
    =======================================*/
    data: () => {
      return {
        video: null,
        gui: null,
        isEstimatedPose: false,
        canEstimated: false,
        poses: [],
        canvas: null,
        context: null,
        net: null,
        watchImage: null,
        keypoints: null
      }
    },

    /*======================================
    methods
    =======================================*/
    methods: {
      setupCamera: async function () {
        this.video = this.$refs.video;

        this.video.srcObject = await navigator.mediaDevices
          .getUserMedia({audio: false, video: true})
          .catch(e => {
            console.log(e.name);
          });
        this.video.width = videoWidth;
        this.video.height = videoHeight;

        return new Promise(resolve => {
          this.video.onloadedmetadata = () => {
            resolve(this.video);
          };
        });
      },

      playCamera: async function () {
        const video = await this.setupCamera();
        video.play();
        return video;
      },

      setupGui(cameras, net) {
        guiState.net = net;

        if (cameras.length > 0) {
          guiState.camera = cameras[0].deviceId;
        }

        this.gui = new dat.GUI({width: 300});
        this.gui.close();
        const algorithmController = this.gui.add(guiState, "algorithm", [
          "single-pose",
          "multi-pose"
        ]);
        let input = this.gui.addFolder("Input");
        const architectureController = input.add(
          guiState.input,
          "mobileNetArchitecture",
          ["1.01", "1.00", "0.75", "0.50"]
        );

        input.add(guiState.input, "outputStride", [8, 16, 32]);
        input
          .add(guiState.input, "imageScaleFactor")
          .min(0.2)
          .max(1.0);
        input.open();

        let single = this.gui.addFolder("Single Pose Detection");
        single.add(guiState.singlePoseDetection, "minPoseConfidence", 0.0, 1.0);
        single.add(guiState.singlePoseDetection, "minPartConfidence", 0.0, 1.0);

        let multi = this.gui.addFolder("Multi Pose Detection");
        multi
          .add(guiState.multiPoseDetection, "maxPoseDetections")
          .min(1)
          .max(20)
          .step(1);
        multi.add(guiState.multiPoseDetection, "minPoseConfidence", 0.0, 1.0);
        multi.add(guiState.multiPoseDetection, "minPartConfidence", 0.0, 1.0);
        multi
          .add(guiState.multiPoseDetection, "nmsRadius")
          .min(0.0)
          .max(40.0);
        multi.open();

        let output = this.gui.addFolder("Output");
        output.add(guiState.output, "showVideo");
        output.add(guiState.output, "showSkeleton");
        output.add(guiState.output, "showPoints");
        output.open();

        architectureController.onChange(architecture => {
          guiState.changeToArchitecture = architecture;
        });

        algorithmController.onChange(value => {
          switch (guiState.algorithm) {
            case "single-pose":
              multi.close();
              single.open();
              break;
            case "multi-pose":
              single.close();
              multi.open();
              break;
          }
        });
      },

      setupFPS() {
        stats.showPanel(0);
        document.body.appendChild(stats.dom);
      },

      setupCanvas: async function () {
        this.canvas = this.$refs.canvas;
        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;
        this.context = this.canvas.getContext("2d");

        // 画像読み込む
        this.watchImage = await preloadImage(glasses);
      },

      drawWrist(keypoints) {

        // dot打つ
        // _.each(keypoints, (keypoint) => {
        //     this.context.beginPath();
        //     this.context.arc(keypoint.position.x, keypoint.position.y, 5, 0, 360, false);
        //     this.context.fillStyle = 'red';
        //     this.context.fill();
        // });

        // 肘から手首までの線
        // this._context.beginPath();
        // this._context.moveTo(leftWrist.position.x, leftWrist.position.y);
        // this._context.lineTo(leftElbow.position.x, leftElbow.position.y);
        // this._context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        // this._context.stroke();
        // this.drawSkelton(keypoints);

        // this.drawButton();

        this.context.save();

        // 時計の描画
        this.drawWatch(keypoints);

        this.context.restore();
      },

      drawSkelton(keypoints) {
        const bodyIds = [5, 6, 11, 12];
        const leftArmsId = [5, 7, 9];
        const rightArmsId = [6, 8, 10];

        const bodyArray = _.filter(keypoints, (point, index) =>
          _.includes(bodyIds, index)
        );
        const rightArmArray = _.filter(keypoints, (point, index) =>
          _.includes(rightArmsId, index)
        );
        const leftArmArray = _.filter(keypoints, (point, index) =>
          _.includes(leftArmsId, index)
        );

        this.drawPolyline(bodyArray);
        this.drawPolyline(rightArmArray);
        this.drawPolyline(leftArmArray);
      },

      drawPolyline(keypoints) {
        this.context.beginPath();
        _.each(keypoints, (point, index) => {
          if (index === 0) {
            this.context.moveTo(point.position.x, point.position.y);
          } else {
            this.context.lineTo(point.position.x, point.position.y);
          }
        });
        this.context.strokeStyle = "rgba(255,0,0,0.8)";
        this.context.stroke();
      },

      drawWatch(keypoints) {
        const leftEye = _.find(keypoints, point => point.part === "leftEye");
        const rightEye = _.find(keypoints, point => point.part === "rightEye");
        const d = Math.sqrt(
          Math.pow(leftEye.position.x - rightEye.position.x, 2) +
          Math.pow(leftEye.position.y - rightEye.position.y, 2)
        );
        const scale = d / 100;
        const posX = ( leftEye.position.x + rightEye.position.x ) / 2;
        const posY = ( leftEye.position.y + rightEye.position.y ) / 2;

        this.context.translate(posX, posY);

        this.context.scale(scale, scale);
        const radian = Math.atan2(leftEye.position.y - rightEye.position.y, leftEye.position.x - rightEye.position.x);
        this.context.rotate(radian);
        this.context.drawImage(this.watchImage, -480, -49);
      },

      drawFinding() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.font = "30px 'Times New Roman'";
        this.context.textAlign = "center";
        this.context.fillText("finding Wrist...", this.canvas.width / 2, this.canvas.height / 2);
      },

      drawButton() {
        this.context.beginPath()
        this.context.rect(this.canvas.width - 100, 0, 100, 100)
        this.context.fill()
      },

      detectPoseInRealTime() {
        this.poseDetectionFrame(this.video, this.net);
      },

      poseDetectionFrame: async function (video, net) {
        const flipHorizontal = true;
        if (guiState.changeToArchitecture) {
          guiState.net.dispose();
          guiState.net = await posenet.load(Number(guiState.changeToArchitecture));
        }
        this.poses = [];
        stats.begin();

        const imageScaleFactor = guiState.input.imageScaleFactor;
        const outputStride = Number(guiState.input.outputStride);

        let minPoseConfidence;
        let minPartConfidence;
        switch (guiState.algorithm) {
          case "single-pose":
            const pose = await guiState.net.estimateSinglePose(
              video,
              imageScaleFactor,
              flipHorizontal,
              outputStride
            );
            this.poses.push(pose);

            minPoseConfidence = Number(
              guiState.singlePoseDetection.minPoseConfidence
            );
            minPartConfidence = Number(
              guiState.singlePoseDetection.minPartConfidence
            );
            break;

          case "multi-pose":
            this.poses = await guiState.net.estimateMultiplePoses(
              video,
              imageScaleFactor,
              flipHorizontal,
              outputStride,
              guiState.multiPoseDetection.maxPoseDetections,
              guiState.multiPoseDetection.minPartConfidence,
              guiState.multiPoseDetection.nmsRadius
            );
            minPoseConfidence = Number(
              guiState.multiPoseDetection.minPoseConfidence
            );
            minPartConfidence = Number(
              guiState.multiPoseDetection.minPartConfidence
            );
            break;
        }

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        _.each(this.poses, ({score, keypoints}) => {
          if (score >= minPoseConfidence) {
            this.isEstimatedPose = true;
            this.keypoints = keypoints;
            this.drawWrist(keypoints);
          } else {
            this.isEstimatedPose = false;
            // this.drawFinding()
          }
        });

        stats.end();

        const rightWrist = _.find(this.keypoints, point => point.part === "leftWrist");
        if(rightWrist.position.x > this.canvas.width - 100 && rightWrist.position.y < 100) {
          sound.play()
        }

        if (!this.canEstimated) return;
        requestAnimationFrame(() => {
          this.poseDetectionFrame(video, net);
        });
      },

      setup: async function () {
        this.net = await posenet.load(0.75);

        this.video = await this.playCamera().catch(e => {
          throw e;
        });

        this.setupGui([], this.net);
        this.setupFPS();
        await this.setupCanvas();
        this.canEstimated = true;
      },

      releaseEstimate() {
        this.canEstimated = false;
        this.gui.destroy();
        const stream = this.video.srcObject;
        const tracks = stream.getTracks();

        _.each(tracks, track => {
          track.stop();
        });

        this.gui = null;
        this.video.srcObject = null;
      }
    },
    mounted: function () {
      // sound.play();
      this.setup().then(() => {
        this.detectPoseInRealTime();
      });
    },
    destroyed() {
      this.releaseEstimate();
    },

  };
</script>

<style lang="scss" scoped>
  .sound {
    position: relative;
    width: 800px;
    height: 600px;
    margin: 0 auto;
  }
  #video {
    transform: scaleX(-1);
    transform-origin: center center;
  }
  #canvas {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .circle {
    position: absolute;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background-color: #000;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    &::after {
      content: "押せる";
      color: #fff;
      font-size: 32px;
      font-weight: bold;
    }
  }
</style>
