// import postPromise from './helper/post-promise';
// import smsClient from './helper/sms-client';
// import { drawContain, drawCover, getFormatKeys, raf, sleep, uploadHashsnap, urlShorter2 } from './helper/utils';
// import store from './store';

// export type CustomActionList = {
//   createcanvasvideo: {canvasSrc: string; videoSrc: string; audioSrc: string; duration: number; save: string; next?: string; sms: NodeActionList['send-sms']};
// };

// const connectedAudio = new Map<HTMLAudioElement, MediaStreamAudioDestinationNode>();

// export const handlers: SendHandler = {
//   async createcanvasvideo({canvasSrc, audioSrc, videoSrc, duration, save, next, sms}) {
//     // 에셋 로드
//     const canvasData = store.get<HTMLCanvasElement|HTMLVideoElement>(canvasSrc);
//     if (!['canvas', 'image', 'video'].includes(canvasData.type)) throw new Error(`Isn't canvas or image or video type: ${JSON.stringify(canvasData)}`);
//     const audioData = store.get(audioSrc);
//     if (audioData.type !== 'audio') throw new Error(`Isn't audio type: ${JSON.stringify(audioData)}`);
//     const audio = audioData.data as HTMLAudioElement;

//     const videoData = store.get(videoSrc);
//     if (videoData.type !== 'video') throw new Error(`Isn't video type: ${JSON.stringify(videoData)}`);
//     const video = videoData.data as HTMLVideoElement;

//     if (!connectedAudio.has(audio)) {
//       const actx = new AudioContext();
//       const asource = actx.createMediaElementSource(audio);
//       const adest = actx.createMediaStreamDestination();
//       asource.connect(adest);
//       connectedAudio.set(audio, adest);
//     }

//     // 녹화 로직
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

//     canvas.width = canvasData.data.width || (canvasData.data as HTMLVideoElement).videoWidth;
//     canvas.height = canvasData.data.height || (canvasData.data as HTMLVideoElement).videoHeight;
//     ctx.drawImage(canvasData.data, 0, 0);
    
//     const canvasStream = canvas.captureStream(60);
//     const canvasTrack = canvasStream.getTracks()[0];
//     const makeFrame= () => {
//       ctx.drawImage(canvasData.data, 0, 0);
//       drawContain(ctx, video);      
//     };
//     raf.add(makeFrame);
//     audio.currentTime = video.currentTime = 0;
//     video.play();
//     audio.play();
//     const adest = connectedAudio.get(audio) as MediaStreamAudioDestinationNode;
//     const stream = new MediaStream([canvasTrack, adest.stream.getAudioTracks()[0]]);
//     const chunks: Blob[] = [];
//     const rec = new MediaRecorder(stream);
//     rec.ondataavailable = ({data}) => chunks.push(data);
//     rec.start();

//     await sleep(duration * 1000);
//     const saveFilePromise = new Promise<Blob>(res => rec.onstop = async () => {
//       const blob = new Blob(chunks, {type: 'video/webm'});

//       video.pause();
//       audio.pause();
//       res(blob);
//       console.log(chunks);
//     });
//     rec.stop();
//     raf.delete(makeFrame);
//     const videoBlob = await saveFilePromise;
//     const webmToMp4Transfer = postPromise.message<ArrayBuffer>(parent, {type: 'webm-to-mp4', data: {arraybuffer: await videoBlob.arrayBuffer()}}, '*');
//     const mp4Blob = window.__mode__ === 'electron' ? await webmToMp4Transfer : videoBlob;
//     console.log(mp4Blob);
//     if (mp4Blob instanceof Error) return alert('error01'); // ffmpeg 설치필요
    
//     const file = new File([new Blob([mp4Blob], {type: 'video/mp4'})], 'video.mp4', {type: 'video/mp4', lastModified: Date.now()});

//     // 템플릿 이미지
//     const {data: templateImage} = store.get<HTMLImageElement>('template');
//     const tCanvas = Object.assign(document.createElement('canvas'), {width: canvasData.data.width, height: canvasData.data.height});
//     const tCtx = tCanvas.getContext('2d') as CanvasRenderingContext2D;
//     tCtx.drawImage(canvasData.data, 0, 0);
//     drawCover(tCtx, templateImage, 0, 0);

//     // s3 업로드
//     const [videoUrl, imageUrl] = await Promise.all([uploadHashsnap(file), uploadHashsnap(tCanvas)]);
//     const shortedUrl = await urlShorter2({
//       title: 'Cartier',
//       // favicon: 'https://www.cartier.co.kr/etc/designs/richemont-car/clientlibs/publish/Clientlibs_common/images/icons/favicon.ico.resource.1525710726240.ico',
//       html: 'https://sms.hashsn.app/template/2228_cartier_0.0.2.html',
//       params: {
//         vn: videoUrl.split('/').pop(),
//         in: imageUrl.split('/').pop(),
//       },
//     });
//     console.log(shortedUrl);

//     save && store.set('string', save, shortedUrl.split('/').pop());

//     // next && this.goto?.({type: 'goto', next});
//     //--------------sms 전송
//     const options = sms;
//     const {data: to} = store.get<string>(options.to);
//     let result: string = '';
//     const formatKeys = getFormatKeys(options.content);
//     const content = formatKeys.reduce((acc, key) => {
//       if (key === 'download') {
//         if (!result) throw new Error('파일을 업로드하지 않음.');
//         throw new Error('URL 축소 로직 추가 예정');
//       } else if (key === 'preview') {
//         if (!shortedUrl) throw new Error('파일을 업로드하지 않음.');
//         acc = acc.replaceAll(`%${key}%`, shortedUrl.split('/').pop());
//       } else if (key.includes(':')) {
//         const [type, storeKey] = key.split(':');
//         if (type === 'store') {
//           const {type, data} = store.get<string>(storeKey);
//           if (type === 'string') acc = acc.replaceAll(`%${key}%`, data);
//         }
//       }
//       return acc;
//     }, options.content);

//     // 모달 처리 필요
//     await smsClient.send({
//       type: 'LMS',
//       from: options.from,
//       content,
//       messages: [{
//         to,
//       }],
//     });
//     options.next && this.goto?.({type: 'goto', next: options.next});
//   },
// };