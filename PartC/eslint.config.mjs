import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    ignores: [
      'media-crawler/**',
      'zhihu-hackathon/**',
      'design-qa/**',
      'profile-output/**',
    ],
  },
  {
    rules: {
      // 这是既有的异步启动/切换流程；单独安排状态流重构，不在安全升级中改变页面行为。
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;
