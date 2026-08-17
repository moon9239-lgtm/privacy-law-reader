# 처음 시작하기

이 문서는 처음 저장소를 받아 실행하는 사람을 위한 안내입니다.

## 준비물

1. Node.js 22를 설치합니다.
2. 터미널에서 `node --version`을 실행해 `v22`로 시작하는지 확인합니다.
3. GitHub에서 이 저장소를 복제할 수 있는 Git을 준비합니다.

## 복제와 설치

1. 저장소를 복제합니다.

   ```powershell
   git clone <public-repository-url>
   ```

2. 폴더로 이동합니다.

   ```powershell
   cd <repository-folder>
   ```

3. 잠금 파일 기준으로 설치합니다.

   ```powershell
   npm.cmd ci
   ```

## 테스트와 빌드

1. 공개 저장소 계약 테스트를 실행합니다.

   ```powershell
   npm.cmd test
   ```

2. 정적 배포 폴더를 만듭니다.

   ```powershell
   npm.cmd run build
   ```

3. 로컬 정적 서버로 확인합니다.

   ```powershell
   npx serve dist
   ```

## Vercel에 올릴 때

Vercel 프로젝트 설정에서는 아래 값만 사용합니다.

- Build Command: `npm run build`
- Output Directory: `dist`

Vercel 프로젝트 ID, 조직 ID, 배포 URL, 미리보기 URL은 저장소에 커밋하지 마세요. 그런 값은 개인 계정과 배포 환경에 속하므로 `.vercel/` 같은 로컬 폴더나 서비스 설정에만 두어야 합니다.
