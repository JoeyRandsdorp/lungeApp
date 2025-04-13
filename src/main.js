import {PoseLandmarker, FilesetResolver, DrawingUtils} from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";
import kNear from "/src/knear.js"

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const enableWebcamButton = document.getElementById("webcamButton");
const stopWebcamButton = document.getElementById("stopWebcamButton");
const logButton = document.getElementById("logButton")

const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

let poseLandmarker = undefined;
let webcamRunning = false;
let results = undefined;

const videoWidth = "480px"
const videoHeight = "270px"

const k = 3;
const machine = new kNear(k);


/********************************************************************
 //load data
 ********************************************************************/
fetch("lunge.json")
    .then(response => response.json())
    .then(data => {
        train(data)
    })
    .catch(error => console.log(error))

// ********************************************************************
// if webcam access, load landmarker and enable webcam button
// ********************************************************************
function startApp() {
    const hasGetUserMedia = () => {
        let _a;
        return !!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia);
    };
    if (hasGetUserMedia()) {
        createPoseLandmarker();
    } else {
        console.warn("getUserMedia() is not supported by your browser");
    }
}

// ********************************************************************
// create mediapipe
// ********************************************************************
const createPoseLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 2
    });
    enableWebcamButton.addEventListener("click", enableCam);
    logButton.addEventListener("click", (e) => logBody(e));
    stopWebcamButton.addEventListener("click", stopCam);

};


/********************************************************************
 // Continuously grab image from webcam stream and detect it.
 ********************************************************************/
function enableCam(event) {
    console.log("start the webcam")
    if (!poseLandmarker) {
        console.log("Wait! poseLandmaker not loaded yet.");
        return;
    }
    webcamRunning = true;
    enableWebcamButton.innerText = "Predicting";
    enableWebcamButton.disabled = true

    const constraints = {       //webcam ruimte
        video: {
            width: {exact: 720},
            height: {exact: 405}
        }
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", async () => {
            canvasElement.style.height = videoHeight;
            canvasElement.style.width = videoWidth;
            video.style.height = videoHeight;
            video.style.width = videoWidth;

            await poseLandmarker.setOptions({ runningMode: "VIDEO" }); //toevoeging voor herstart landmarks
            predictWebcam();
        });
    });
}

// ********************************************************************
// detect poses!!
// ********************************************************************
async function predictWebcam() {
    const result = await poseLandmarker.detectForVideo(video, performance.now());
    results = result;
    drawPose(result);

    if (results && results.landmarks && results.landmarks[0]) {
        const remake = results.landmarks[0].map(coor => [coor.x, coor.y, coor.z]).flat();
        const prediction = machine.classify(remake);
        console.log("Voorspelling:", prediction);
        updateFeedbackBoxes(prediction);
    }

    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// ********************************************************************
// draw the poses or log them in the console
// ********************************************************************
function drawPose(result) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, {radius: 3});
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
}

/*************************************************************
 //train
 **************************************************************/
function train(poses) {
    if (!Array.isArray(poses)) {
        console.error("Training data not in expected format.");
        return;
    }
    for (let pose of poses) {
        if (Array.isArray(pose.points) && typeof pose.label === "string") {
            machine.learn(pose.points, pose.label);
        } else {
            console.warn("Skipping invalid pose entry:", pose);
        }
    }
}

/**********************************************************
 //log console
 *********************************************************/
function logBody() {
    if (!results || !results.landmarks) {
        console.warn("Nog geen resultaten beschikbaar");
        return;
    }

    const remake = results.landmarks[0].map(coor => [coor.x, coor.y, coor.z]).flat();
    const prediction = machine.classify(remake);
    console.log("Voorspelling:", prediction);
    console.log("Landmarks (rauw):", results.landmarks[0]);
}

/**********************************************
 //visualisatie van predictions
**********************************************/
function updateFeedbackBoxes(prediction) {
    const colors = ["red", "red", "red"];

    switch (prediction) {
        case "goed":
            colors[0] = "green";
            colors[1] = "green";
            colors[2] = "green";
            break;
        case "vFrame":
            colors[2] = "green";
            break;
        case "dKnie":
            colors[0] = "green";
            break;
        case "aFrame":
            colors[1] = "green";
            break;
        case "frame":
            colors[1] = "green";
            colors[2] = "green";
            break;
        case "aKnie":
            colors[0] = "green";
            colors[1] = "green";
            break;
        case "vKnie":
            colors[1] = "green";
            colors[2] = "green";
            break;
        case "Alles":
        default:
            break;
    }
    for (let i = 0; i < 3; i++) {
        const box = document.getElementById(`box${i + 1}`);
        box.classList.remove("bg-red-500", "bg-green-500");
        box.classList.add(`bg-${colors[i]}-500`);
    }
}

/***********************************************************
 //stop webcam
**********************************************************/
function stopCam() {
    webcamRunning = false;
    enableWebcamButton.innerText = "START WEBCAM";
    enableWebcamButton.disabled = false;

    const stream = video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }

    video.srcObject = null;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    console.log("Webcam gestopt");
}

startApp()
