/** Original, offline story captions. Mission stories introduce a problem without revealing quiz answers. */
export type StoryScene = 'campus' | 'privacy' | 'library' | 'sorting' | 'media' | 'study' | 'team';

export interface StoryBeat {
  id: string;
  speaker: '旁白' | '小羽' | '米米';
  text: string;
  scene: StoryScene;
  durationMs: number;
}

export const openingStory: readonly StoryBeat[] = [
  {
    id: 'opening-1', speaker: '旁白', scene: 'campus', durationMs: 8750,
    text: '校園裡的 AI 幫手突然忙亂起來，奇怪的推薦與消息，讓大家不知道該怎麼辦。',
  },
  {
    id: 'opening-2', speaker: '米米', scene: 'campus', durationMs: 8750,
    text: '小羽，我是米米！幾個服務把事情弄混了，我們一起找出問題，讓校園恢復安心吧。',
  },
  {
    id: 'opening-3', speaker: '小羽', scene: 'study', durationMs: 8750,
    text: '魔法需要好判斷！從聊天到寫作業，我想練習讓 AI 幫忙，也照顧身邊每個人。',
  },
  {
    id: 'opening-4', speaker: '旁白', scene: 'team', durationMs: 8750,
    text: '選一項生活任務，跟伙伴一起闖關。每次答對，就能施展魔法，修復校園服務！',
  },
];

export const levelStories: Readonly<Record<number, readonly StoryBeat[]>> = {
  1: [
    {
      id: 'level-01-1', speaker: '旁白', scene: 'privacy', durationMs: 8500,
      text: '故事推薦台亮了起來，搜集魔盒卻不停跳出新問題，連同學們的小祕密也想知道。',
    },
    {
      id: 'level-01-2', speaker: '米米', scene: 'privacy', durationMs: 8500,
      text: '它只是想幫大家找故事，怎麼問了這麼多呢？小羽，這些資料都和讀故事有關嗎？',
    },
    {
      id: 'level-01-3', speaker: '小羽', scene: 'privacy', durationMs: 8500,
      text: '讓我們看看生活中的分享難題！我準備好魔杖了，一起幫它把服務調整得更安心。',
    },
  ],
  2: [
    {
      id: 'level-02-1', speaker: '旁白', scene: 'library', durationMs: 8500,
      text: '圖書館的迷言書靈帶來好多答案，同學翻開課本一看，卻發現有些內容對不起來。',
    },
    {
      id: 'level-02-2', speaker: '米米', scene: 'library', durationMs: 8500,
      text: '每張答案卡都寫得好有把握，讓我也有點迷糊。它說得很肯定，就一定沒錯嗎？',
    },
    {
      id: 'level-02-3', speaker: '小羽', scene: 'library', durationMs: 8500,
      text: '這次輪到我們當小偵探！跟著題目找找線索，把讓同學困惑的地方一個個解開。',
    },
  ],
  3: [
    {
      id: 'level-03-1', speaker: '旁白', scene: 'sorting', durationMs: 8500,
      text: '校園服務站收到畫圖、練習和求助的任務，混淆機兵忙著分配，卻越分越混亂。',
    },
    {
      id: 'level-03-2', speaker: '米米', scene: 'sorting', durationMs: 8500,
      text: '大家需要的幫忙不一樣，它卻只用同一種方法。小羽，這些任務真的都一樣嗎？',
    },
    {
      id: 'level-03-3', speaker: '小羽', scene: 'sorting', durationMs: 8500,
      text: '我來看清楚每個任務的需要！一起挑戰生活問題，讓合適的幫手出現在合適的地方。',
    },
  ],
  4: [
    {
      id: 'level-04-1', speaker: '旁白', scene: 'media', durationMs: 8500,
      text: '班級群組出現一段奇怪影片，幻影面具的聲音和畫面，讓大家越看越分不清楚。',
    },
    {
      id: 'level-04-2', speaker: '米米', scene: 'media', durationMs: 8500,
      text: '這聲音好熟悉，可是事情真的發生過嗎？現在的工具，連聲音和畫面都能改變呢。',
    },
    {
      id: 'level-04-3', speaker: '小羽', scene: 'media', durationMs: 8500,
      text: '先別讓奇怪的消息嚇跑大家！跟我一起闖關，練習面對那些看起來很真的畫面。',
    },
  ],
  5: [
    {
      id: 'level-05-1', speaker: '旁白', scene: 'study', durationMs: 8500,
      text: '代寫紙龍送來一疊漂亮作業，教室卻安靜下來。同學看著自己的本子，不知道怎麼說明。',
    },
    {
      id: 'level-05-2', speaker: '米米', scene: 'study', durationMs: 8500,
      text: '它想讓作業變輕鬆，但大家好像沒有真正學會。小羽，你想要怎樣的學習幫手呢？',
    },
    {
      id: 'level-05-3', speaker: '小羽', scene: 'study', durationMs: 8500,
      text: '我希望完成作業時，也能說出自己的想法！一起挑戰，找回學習時那份踏實的感覺。',
    },
  ],
  6: [
    {
      id: 'level-06-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '班上準備一場小活動，全能齒輪王提出好多計畫，卻忘了大家的設備和需要不同。',
    },
    {
      id: 'level-06-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '前面學過的本領都派得上用場！可是計畫再漂亮，如果有人跟不上，該怎麼辦呢？',
    },
    {
      id: 'level-06-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '我的魔法要讓每個伙伴都能參加！一起看看生活任務，讓班級合作變得更順利。',
    },
  ],
  7: [
    {
      id: 'level-07-1', speaker: '旁白', scene: 'privacy', durationMs: 8500,
      text: '校園相簿準備開張，搜集魔盒把活動照片排得整整齊齊，卻沒發現有人面露擔心。',
    },
    {
      id: 'level-07-2', speaker: '米米', scene: 'privacy', durationMs: 8500,
      text: '照片裡有好幾位同學，也藏著不同的心情。只照顧一個人的想法，會不會漏掉誰？',
    },
    {
      id: 'level-07-3', speaker: '小羽', scene: 'privacy', durationMs: 8500,
      text: '這次我要多想一步，看看分享會影響哪些人！跟我一起出發，讓相簿帶來安心的回憶。',
    },
  ],
  8: [
    {
      id: 'level-08-1', speaker: '旁白', scene: 'library', durationMs: 8500,
      text: '迷言書靈翻出新舊公告，做出兩份完全不同的建議。同學討論半天，還是拿不定主意。',
    },
    {
      id: 'level-08-2', speaker: '米米', scene: 'library', durationMs: 8500,
      text: '兩邊都說自己是對的，光看一眼好像不夠。哪些線索，才能幫我們看清楚事情呢？',
    },
    {
      id: 'level-08-3', speaker: '小羽', scene: 'library', durationMs: 8500,
      text: '小偵探要升級了！讓我們比較更多線索，在還不確定的時候，也能做出穩妥的選擇。',
    },
  ],
  9: [
    {
      id: 'level-09-1', speaker: '旁白', scene: 'sorting', durationMs: 8500,
      text: '混淆機兵幫社團分組，一些同學卻找不到自己的位置。大家的興趣，並沒有被好好看見。',
    },
    {
      id: 'level-09-2', speaker: '米米', scene: 'sorting', durationMs: 8500,
      text: '同學明明有不同的喜好，它卻把幾個人當成一樣。這樣的分類，會不會讓人委屈？',
    },
    {
      id: 'level-09-3', speaker: '小羽', scene: 'sorting', durationMs: 8500,
      text: '我想聽見每位同學的想法！一起找出分類裡的盲點，讓服務能看見更多人的需要。',
    },
  ],
  10: [
    {
      id: 'level-10-1', speaker: '旁白', scene: 'media', durationMs: 8500,
      text: '幻影面具帶來更逼真的聲音和影片，消息一下子傳開，有位同學卻急得快哭出來。',
    },
    {
      id: 'level-10-2', speaker: '米米', scene: 'media', durationMs: 8500,
      text: '大家都在猜是真是假，可是影片裡的人也需要被照顧。小羽，我們還能想到什麼？',
    },
    {
      id: 'level-10-3', speaker: '小羽', scene: 'media', durationMs: 8500,
      text: '這次不只要找出線索，也要留意身邊的伙伴！一起破解訊息難題，減少不必要的傷害。',
    },
  ],
  11: [
    {
      id: 'level-11-1', speaker: '旁白', scene: 'study', durationMs: 8500,
      text: '代寫紙龍做出精彩的報告，老師問起準備過程時，同學卻不知道哪些想法是自己的。',
    },
    {
      id: 'level-11-2', speaker: '米米', scene: 'study', durationMs: 8500,
      text: '看起來完成了，不一定真的學會。讓工具幫忙的時候，我們怎麼留下自己的努力呢？',
    },
    {
      id: 'level-11-3', speaker: '小羽', scene: 'study', durationMs: 8500,
      text: '我想交出能親口說明的成果！一起挑戰學習任務，讓幫手陪我們成長，也保留誠實。',
    },
  ],
  12: [
    {
      id: 'level-12-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '全能齒輪王要升級全校的 AI 服務，大家提出好多願望，也發現不能只顧最快完成。',
    },
    {
      id: 'level-12-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '有人在意資料，有人需要別的參加方式。走過這些任務，我們能不能一起想得更周到？',
    },
    {
      id: 'level-12-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '最後挑戰到了！帶上我們學會的本領，一起完成守護約定，讓校園的 AI 幫手更可靠。',
    },
  ],
};

export const getOpeningStory = (): readonly StoryBeat[] => openingStory;

export const getLevelStory = (levelId: number): readonly StoryBeat[] => {
  const story = levelStories[levelId];
  if (!story) throw new Error(`找不到第 ${levelId} 關的劇情。`);
  return story;
};
