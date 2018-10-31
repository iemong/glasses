import * as posenet from '@tensorflow-models/posenet';
import EventEmitter from "events";
import _ from "lodash";
import dat from "dat.gui";
import Stats from "stats.js";
import {preloadImage} from "./imageHelper";

const stats = new Stats();
const videoWidth = 600;
const videoHeight = 500;

const guiState = {
    algorithm: "multi-pose",
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

class EstimatePoseFromMovie extends EventEmitter {
    constructor() {
        super();
        this._video = null;
        this._gui = null;
        this._isEstimatedPose = false;
        this._canEstimated = false;
        this._poses = [];
        this._canvas = null;
        this._context = null;
        this._net = null;
        this._watchImage = null;
    }

    async _setupCamera() {
        this._video = document.querySelector("#video");

        this._video.srcObject = await navigator.mediaDevices
            .getUserMedia({audio: false, video: true})
            .catch(e => {
                console.log(e.name);
            });
        this._video.width = videoWidth;
        this._video.height = videoHeight;

        return new Promise(resolve => {
            this._video.onloadedmetadata = () => {
                resolve(this._video);
            };
        });
    }

    async _playCamera() {
        const video = await this._setupCamera();
        video.play();
        return video;
    }

    _setupGui(cameras, net) {
        guiState.net = net;

        if (cameras.length > 0) {
            guiState.camera = cameras[0].deviceId;
        }

        this._gui = new dat.GUI({width: 300});
        this._gui.close();
        const algorithmController = this._gui.add(guiState, "algorithm", [
            "single-pose",
            "multi-pose"
        ]);
        let input = this._gui.addFolder("Input");
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

        let single = this._gui.addFolder("Single Pose Detection");
        single.add(guiState.singlePoseDetection, "minPoseConfidence", 0.0, 1.0);
        single.add(guiState.singlePoseDetection, "minPartConfidence", 0.0, 1.0);

        let multi = this._gui.addFolder("Multi Pose Detection");
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

        let output = this._gui.addFolder("Output");
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
    }

    _setupFPS() {
        stats.showPanel(0);
        document.body.appendChild(stats.dom);
    }

    async _setupCanvas() {
        this._canvas = document.querySelector("#canvas");
        this._canvas.width = videoWidth;
        this._canvas.height = videoHeight;
        this._context = this._canvas.getContext("2d");

        // 画像読み込む
        this._watchImage = await preloadImage('https://products.baby-g.jp/product/image/1425542683952/');
    }

    _drawWrist(keypoints) {
        const leftWrist = _.find(keypoints, point => point.part === "rightWrist");
        const leftElbow = _.find(keypoints, point => point.part === "rightElbow");
        const d = Math.sqrt(
            Math.pow(leftWrist.position.x - leftElbow.position.x, 2) +
            Math.pow(leftWrist.position.y - leftElbow.position.y, 2)
        );
        const scale = d / 500;


        // // dot打つ
        // _.each(keypoints, (keypoint) => {
        //     this._context.beginPath();
        //     this._context.arc(keypoint.position.x, keypoint.position.y, 5, 0, 360, false);
        //     this._context.fillStyle = 'red';
        //     this._context.fill();
        // });

        // 肘から手首までの線
        // this._context.beginPath();
        // this._context.moveTo(leftWrist.position.x, leftWrist.position.y);
        // this._context.lineTo(leftElbow.position.x, leftElbow.position.y);
        // this._context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        // this._context.stroke();

        this._context.save();

        this._context.translate(leftWrist.position.x, leftWrist.position.y);
        this._context.scale(scale, scale);
        const radian = Math.atan2(leftWrist.position.y - leftElbow.position.y, leftWrist.position.x - leftElbow.position.x);
        this._context.rotate(radian);
        this._context.drawImage(this._watchImage, -100, -120, 200, 240);

        this._context.restore();
    }

    _drawFinding() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._context.font = "30px 'Times New Roman'";
        this._context.textAlign = "center";
        this._context.fillText("finding Wrist...", this._canvas.width / 2, this._canvas.height / 2);
    }


    detectPoseInRealTime() {
        this._poseDetectionFrame(this._video, this._net);
    }

    async _poseDetectionFrame(video, net) {
        const flipHorizontal = true;
        if (guiState.changeToArchitecture) {
            guiState.net.dispose();
            guiState.net = await posenet.load(Number(guiState.changeToArchitecture));
        }
        this._poses = [];
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
                this._poses.push(pose);

                minPoseConfidence = Number(
                    guiState.singlePoseDetection.minPoseConfidence
                );
                minPartConfidence = Number(
                    guiState.singlePoseDetection.minPartConfidence
                );
                break;

            case "multi-pose":
                this._poses = await guiState.net.estimateMultiplePoses(
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

        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
        _.each(this._poses, ({score, keypoints}) => {
            console.log(this._poses)
            if (score >= minPoseConfidence) {
                this._isEstimatedPose = true;
                this._drawWrist(keypoints);
            } else {
                this._isEstimatedPose = false;
                // this._drawFinding()
            }
        });

        stats.end();

        if (!this._canEstimated) return;
        requestAnimationFrame(() => {
            this._poseDetectionFrame(video, net);
        });
    }

    async setup() {
        this._net = await posenet.load(0.75);

        this._video = await this._playCamera().catch(e => {
            throw e;
        });

        this._setupGui([], this._net);
        this._setupFPS();
        await this._setupCanvas();
        this._canEstimated = true;
    }

    releaseEstimate() {
        this._canEstimated = false;
        this._gui.destroy();
        const stream = this._video.srcObject;
        const tracks = stream.getTracks();

        _.each(tracks, track => {
            track.stop();
        });

        this._gui = null;
        this._video.srcObject = null;
    }
}

export default new EstimatePoseFromMovie();
