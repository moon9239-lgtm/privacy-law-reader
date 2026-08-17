export const ONBOARDING_STORAGE_KEY = "privacy-reader-onboarding-seen-v1";

export const DESKTOP_ONBOARDING_STEPS = [
  {
    target: ".document-switcher",
    title: "문서 전환",
    description: "법률, 시행령, 고시를 이곳에서 바로 바꿔 읽을 수 있습니다.",
  },
  {
    target: ".header-search",
    title: "통합 검색",
    description: "찾는 표현을 입력하면 법률, 시행령, 고시의 정확히 일치하는 조문을 확인할 수 있습니다.",
  },
  {
    target: ".header-controls-row",
    title: "읽기 화면",
    description: "Light/Dark 전환, 전체 화면, 글자 크기와 행간을 조절해 읽기 편한 화면으로 바꿀 수 있습니다.",
  },
  {
    target: "#navigationPane",
    title: "조문 목차",
    description: "장과 절을 펼치거나 접어 필요한 조문으로 바로 이동할 수 있습니다. 목차 경계는 드래그해 너비를 조절하고, 가운데 탭으로 접을 수 있습니다.",
  },
  {
    target: "#articleBody",
    title: "본문 펼침과 연결 조문",
    description: "호와 목이 있는 조문은 작은 펼침/닫힘 버튼으로 원하는 깊이만 볼 수 있습니다. 밑줄 친 연결 조문을 누르면 시행령과 고시가 바로 이어집니다.",
  },
  {
    target: ".reader-layout",
    title: "비교 화면",
    description: "법률·시행령·고시가 함께 열리면 영역 사이 경계선을 드래그해 각 화면의 너비를 조절할 수 있습니다.",
  },
  {
    target: "#articleBody",
    title: "제재 조문",
    description: "과징금·과태료·벌칙 버튼을 누르면 해당 제재 조문과 연결 근거를 바로 확인할 수 있습니다.",
    demo: "sanction",
  },
  {
    target: "#articleBody .future-amendment-notice",
    title: "시행예정 조문",
    description: "실제 시행예정 조문으로 이동했습니다. 시행일과 빨간색으로 표시된 변경 내용을 이 영역에서 바로 확인할 수 있습니다.",
    demo: "future-amendment",
  },
  {
    target: ".future-comparison-dialog[open]",
    title: "신구대비표",
    description: "신구대비표를 열어 현행과 시행예정을 같은 항·호 단위로 나란히 비교합니다. 파란색은 현행에서 바뀌는 부분, 빨간색은 시행예정에서 바뀌는 부분입니다.",
    demo: "future-comparison",
  },
  {
    target: "#toolsMenuButton",
    title: "도구",
    description: "인쇄, 시행예정 조문 보이기/숨기기, 도움말 다시 보기를 사용할 수 있습니다.",
  },
];

export const MOBILE_ONBOARDING_STEPS = [
  {
    target: ".document-switcher",
    title: "문서와 글자 크기",
    description: "법률·시행령·고시를 전환하고, 오른쪽 −/+ 버튼으로 글자 크기를 조절할 수 있습니다. ? 버튼으로 도움말을 다시 볼 수 있습니다.",
  },
  {
    target: ".theme-segments",
    title: "테마 전환",
    description: "Light/Dark를 눌러 화면 밝기를 바꿀 수 있습니다.",
  },
  {
    target: ".header-search",
    title: "통합 검색",
    description: "찾는 표현을 입력하면 법률, 시행령, 고시의 정확히 일치하는 조문을 찾을 수 있습니다.",
  },
  {
    target: "#mobileNavigation",
    title: "모바일 하단 탐색",
    description: "화면 아래 목차열기, 연결규정, 검색 버튼으로 필요한 화면을 바로 열 수 있습니다.",
  },
  {
    target: "#articleBody",
    title: "본문과 제재 조문",
    description: "밑줄 친 연결 조문을 누르면 연결된 시행령·고시를 확인할 수 있습니다. 과징금·과태료·벌칙 버튼도 해당 조문을 바로 보여줍니다.",
    demo: "sanction",
  },
  {
    target: "#articleBody .future-amendment-notice",
    title: "시행예정 조문",
    description: "실제 시행예정 조문으로 이동했습니다. 시행일과 빨간색으로 표시된 변경 내용을 이 영역에서 바로 확인할 수 있습니다.",
    demo: "future-amendment",
  },
];

export const ONBOARDING_STEPS = DESKTOP_ONBOARDING_STEPS;

export function onboardingSteps(mobile) {
  return mobile ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS;
}

export function shouldShowOnboarding(storage) {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) !== "complete";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(storage) {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, "complete");
    return true;
  } catch {
    return false;
  }
}
