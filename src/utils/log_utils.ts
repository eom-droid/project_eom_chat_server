import path from "path";
import { createStream } from "rotating-file-stream";

const generator = (time: number | Date, index?: number) => {
  // 처음에 time이 null이 들어오는 이유
  // 1. 처음에 createStream 실행 시 RotatingFileStream에 generator 함수를 넣어주지만
  // 2. RotatingFileStream 객체의 constructor에서 generator 함수 인자에 null을 넣어서 실행하도록 rtf가 설계되어있음
  // 3. 그래서 처음에는 null이 들어오게 됨
  // 4. 그 다음부터는 Date 객체로 들어온다.
  // index -> 파일이 너무 커지는것을 방지하는 역할을 하지만 현재는 사용 X

  if (!time) time = new Date();
  // 예제 코드에서는 아래와 같은 방식을 사용했지만 실질적으로 위 같이 현재의 서버 시간을 넣어줘야함
  // if (!time) return "access.log";
  if (typeof time === "number") time = new Date(time);

  const yearmonth =
    time.getFullYear() + (time.getMonth() + 1).toString().padStart(2, "0"); // padStart(2, "0")은 두자리로 만든다. 만약 6월이면 자동으로 앞에 0가 붙는다.
  const day = time.getDate().toString().padStart(2, "0");
  const hour = time.getHours().toString().padStart(2, "0");
  // const minute = time.getMinutes().toString().padStart(2, "0");

  // 파일명을 반환
  return `${yearmonth}${path.sep}${yearmonth}${day}-${hour}.log`;
  // window 운영체제는 "/"대신 ${path.sep}을 사용해서 작성한다.
};

// createStream 함수를 통해 RotatingFileStream(extends Writable) 객체를 생성
export const accessLogStream = createStream(generator, {
  // 파일명 생성 기준, 2개의 파라미터가 오고
  interval: "1h", // 1m은 1분 간격, 1d는 하루 간격으로 로그가 생성됨

  path: path.join(__dirname, "./../log"), // 파일 경로, __dirname는 현재 파일이 실행되고 있는 파일 경로, join()함수는 경로를 합쳐주는 것이다. 이 파일의 폴더로 가서 log라는 폴더를 만들고 파일 생성명은 generator에서 오는 것이다,
});
