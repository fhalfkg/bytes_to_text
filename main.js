const fs = require('fs');
const path = require('path');

function main() {
  if (!process.argv[2]) {
    console.log('DMTQ Tools - bytes to text');
    console.log('This tool converts DMTQ pattern bytes to understandable txt format.');
    console.log('Usage: bytestotext <file>.bytes - Convert from bytes to text interchange format.');
    // console.log('Usage: bytestotext <file>.txt - Convert from the file create by this tool back to .bytes file.');
    return;
  } else {
    if (path.extname(process.argv[2]) == '.bytes') {
      try {
        const file = fs.readFileSync(process.argv[2]);
        const outputFile = `${path.dirname(process.argv[2])}/${path.basename(process.argv[2], path.extname(process.argv[2]))}.txt`;

        console.log(outputFile);

        const header = file.readInt32LE(0); // 4바이트
        const infoOffset = file.readInt32LE(4); // 4바이트

        const info = file.slice(infoOffset, file.length); // infoOffset만큼 잘라낸 부분

        const soundCount = info.readInt16LE(); // 2바이트
        const trackCount = info.readInt16LE(2); // 2바이트
        const positionPerMeasure = info.readInt16LE(4); // 2바이트
        const initialBpm = info.readFloatLE(6); // 4바이트
        const endPosition = info.readInt32LE(10); // 4바이트
        const tagB = info.readInt32LE(14); // 4바이트
        const tagC = info.readInt32LE(18); // 4바이트
        const totalCommandCount = info.readInt32LE(22); // 4바이트

        fs.writeFileSync(outputFile, `#SOUND_COUNT ${soundCount}\n`);
        fs.appendFileSync(outputFile, `#TRACK_COUNT ${trackCount}\n`);
        fs.appendFileSync(outputFile, `#POSITION_PER_MEASURE ${positionPerMeasure}\n`);
        fs.appendFileSync(outputFile, `#END_POSITION ${endPosition}\n`);
        fs.appendFileSync(outputFile, `#TAGB ${tagB}\n`);
        fs.appendFileSync(outputFile, `#TAGC ${tagC}\n`);
        fs.appendFileSync(outputFile, `#TOTAL_CMD_COUNT ${totalCommandCount}\n`);

        // 사운드 테이블 읽기
        let currentOffset = 0x8;
        for (let i = 0; i < soundCount; i++) {
          const soundInfo = file.slice(currentOffset);
          const id = ('0000' + soundInfo.readInt16LE().toString()).slice(-4);
          const fileNameChars = soundInfo.slice(3, 40).toString();
          const fileName = fileNameChars.replace(/\0/g, '').trim();
          fs.appendFileSync(outputFile, `#WAV${id} ${fileName}\n`);

          currentOffset += 0x43;
        }

        fs.appendFileSync(outputFile, 'POSITION COMMAND PARAMETER\n');
        let currentTrackCount = 0;
        while (currentOffset < infoOffset) {
          const trackHeader = file.readInt16LE(currentOffset);
          currentOffset += 2;
          const trackName = file.slice(currentOffset, currentOffset += 59).toString().replace(/\0/g, '').trim();

          const trackPosition = file.readInt32LE(currentOffset);
          let cmd = file.readInt8(currentOffset += 4);
          currentOffset += 1;
          if (cmd == 0x0) {
            // 트랙 읽기 시작
            const shiftedNoteCount = file.readInt32LE(currentOffset);
            const noteCount = file.readInt32LE(currentOffset += 4);
            currentOffset += 4;
            fs.appendFileSync(outputFile, `#${trackPosition} TRACK_START ${currentTrackCount} '${trackName}' ${noteCount}\n`);

            for (let i = 0; i < noteCount; i++) {
              let position = file.readInt32LE(currentOffset);
              cmd = file.readInt8(currentOffset += 4);
              currentOffset += 1;
              switch (cmd) {
                case 0: { // 트랙 시작
                  currentOffset += 8;
                  console.log('Warning: New track starts before track end');
                  fs.appendFileSync(outputFile, `#${trackPosition} TRACK_START ${currentTrackCount} '${trackName}' ${noteCount}\n`);
                  break;
                }
                case 1: { // 노트
                  const soundIndex = ('0000' + file.readInt16LE(currentOffset).toString()).slice(-4);
                  const volume = file.readInt8(currentOffset += 2);
                  const pan = file.readInt8(currentOffset += 1);
                  const type = file.readInt8(currentOffset += 1);
                  const length = file.readUInt8(currentOffset += 1);
                  const unknown = file.readInt16LE(currentOffset += 1);
                  currentOffset += 2;
                  fs.appendFileSync(outputFile, `#${position} NOTE ${soundIndex} ${volume} ${pan} ${type} ${length} ${unknown}\n`);
                  break;
                }
                case 2: {
                  const volume = file.readInt8(currentOffset);
                  const unknown1 = file.readInt8(currentOffset += 1);
                  const unknown2 = file.readInt8(currentOffset += 1);
                  const unknown3 = file.readInt8(currentOffset += 1);
                  const unknown4 = file.readInt32LE(currentOffset += 1);
                  currentOffset += 4;
                  fs.appendFileSync(outputFile, `#${position} VOLUME ${volume} ${unknown1} ${unknown2} ${unknown3} ${unknown4}\n`);
                  break;
                }
                case 3: { // BPM 변경
                  const bpm = file.readInt32LE(currentOffset);
                  const unknown = file.readInt32LE(currentOffset += 4);
                  currentOffset += 4;
                  fs.appendFileSync(outputFile, `#${position} BPM_CHANGE ${bpm} ${unknown}\n`);
                  break;
                }
                default: { // 기타
                  const unknown1 = file.readBigInt64LE(currentOffset);
                  currentOffset += 8;
                  fs.appendFileSync(outputFile, `#${position} ${cmd} ${unknown1}`);
                  break;
                }
              }
            }
          }
          currentTrackCount++;
        }
        return;
      } catch (err) {
        console.error(err);
        return;
      }
    }
  }
}

main();