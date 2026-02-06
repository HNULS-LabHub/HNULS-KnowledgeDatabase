<template>
  <div class="kb-rag-header flex justify-between items-end">
    <div>
      <div class="flex items-center gap-3 mb-2">
        <div
          class="flex items-center gap-2.5 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl"
        >
          <svg
            class="w-5 h-5 text-indigo-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span class="text-lg font-bold text-slate-900">检索增强生成 (RAG)</span>
        </div>
      </div>
      <p class="text-slate-500 m-0">实时调试向量检索与上下文召回。</p>
    </div>
    <div class="flex gap-2">
      <span class="badge indigo">
        <svg
          class="badge-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        Hybrid Search
      </span>
      <span class="badge emerald">
        <svg
          class="badge-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          ></path>
        </svg>
        Cohere Rerank
      </span>
    </div>
  </div>
</template>
