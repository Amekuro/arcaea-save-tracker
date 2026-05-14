<template>
  <div class="marquee-wrapper" ref="wrapperRef">
    <div class="marquee-content" ref="contentRef">
      <slot></slot>
    </div>
  </div>
</template>

<script>
// ==========================================
// 全局跑马灯协调器 (单例)
// 所有实例共享同一个 RAF 时钟，保证完美同步
// ==========================================
const regs = new Set()
let maxDist = 0
let rafId = null
let lastTs = 0
let phase = 'idle_left'  // idle_left → forward → idle_right → backward
let offset = 0
let waitTimer = 0

const SPEED = 40   // 像素/秒
const WAIT = 1.5   // 两端停留秒数

function recalcMax() {
  maxDist = 0
  for (const r of regs) {
    if (r.dist > maxDist) maxDist = r.dist
  }
}

function startLoop() {
  if (rafId || regs.size === 0) return
  lastTs = performance.now()
  phase = 'idle_left'
  offset = 0
  waitTimer = 0
  rafId = requestAnimationFrame(tick)
}

function stopLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

function applyMask(el, left, right) {
  let val = 'none'
  if (left && right) {
    val = 'linear-gradient(to right, transparent, black 15px, black calc(100% - 15px), transparent)'
  } else if (left) {
    val = 'linear-gradient(to right, transparent, black 15px)'
  } else if (right) {
    val = 'linear-gradient(to right, black calc(100% - 15px), transparent)'
  }
  el.style.maskImage = val
  el.style.webkitMaskImage = val
}

function calcX(r) {
  switch (phase) {
    case 'idle_left':   return 0
    case 'forward':     return Math.min(offset, r.dist)
    case 'idle_right':  return r.dist
    case 'backward':    return Math.max(0, r.dist - offset)
  }
}

function tick(ts) {
  const dt = (ts - lastTs) / 1000
  lastTs = ts

  // 状态机推进
  switch (phase) {
    case 'idle_left':
      waitTimer += dt
      if (waitTimer >= WAIT) { phase = 'forward'; offset = 0; waitTimer = 0 }
      break
    case 'forward':
      offset += SPEED * dt
      if (offset >= maxDist) { offset = maxDist; phase = 'idle_right' }
      break
    case 'idle_right':
      waitTimer += dt
      if (waitTimer >= WAIT) { phase = 'backward'; offset = 0; waitTimer = 0 }
      break
    case 'backward':
      offset += SPEED * dt
      if (offset >= maxDist) { offset = maxDist; phase = 'idle_left'; waitTimer = 0 }
      break
  }

  // 只更新当前在视口内的元素
  for (const r of regs) {
    if (!r.visible) continue

    const x = calcX(r)
    r.contentEl.style.transform = `translateX(${-x}px)`

    // 只在模糊状态发生变化时更新 mask（避免每帧触发合成层重绘）
    const maskLeft = x > 0.5
    const maskRight = (r.dist - x) > 0.5
    if (maskLeft !== r.maskLeft || maskRight !== r.maskRight) {
      r.maskLeft = maskLeft
      r.maskRight = maskRight
      applyMask(r.wrapperEl, maskLeft, maskRight)
    }
  }

  rafId = requestAnimationFrame(tick)
}

function register(r)   { regs.add(r); recalcMax(); startLoop() }
function unregister(r) { regs.delete(r); recalcMax(); if (regs.size === 0) stopLoop() }
function updateDist(r, d) { r.dist = d; recalcMax(); if (d > 0 && !rafId) startLoop() }
</script>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const wrapperRef = ref(null)
const contentRef = ref(null)
let registration = null
let resizeObs = null
let intersectObs = null
let mutationObs = null

const check = () => {
  if (!wrapperRef.value || !contentRef.value) return

  // 先临时重置 transform，否则 scrollWidth 会受到当前偏移量的影响
  if (registration) {
    contentRef.value.style.transform = ''
  }

  const overflow = contentRef.value.scrollWidth - wrapperRef.value.offsetWidth

  if (overflow > 1) {
    if (!registration) {
      registration = {
        wrapperEl: wrapperRef.value,
        contentEl: contentRef.value,
        dist: overflow,
        visible: false,
        maskLeft: false,
        maskRight: false
      }
      register(registration)
    } else {
      updateDist(registration, overflow)
    }
  } else {
    if (registration) {
      contentRef.value.style.transform = ''
      applyMask(wrapperRef.value, false, false)
      unregister(registration)
      registration = null
    }
  }
}

onMounted(() => {
  nextTick(check)

  resizeObs = new ResizeObserver(check)
  if (wrapperRef.value) resizeObs.observe(wrapperRef.value)

  // 监听插槽内容文本变化（语言切换时 ResizeObserver 检测不到，因为 overflow:hidden 限制了布局尺寸）
  mutationObs = new MutationObserver(check)
  if (contentRef.value) {
    mutationObs.observe(contentRef.value, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  intersectObs = new IntersectionObserver(
    ([entry]) => {
      if (registration) {
        registration.visible = entry.isIntersecting
        if (entry.isIntersecting) {
          const x = calcX(registration)
          registration.contentEl.style.transform = `translateX(${-x}px)`
          const ml = x > 0.5
          const mr = (registration.dist - x) > 0.5
          registration.maskLeft = ml
          registration.maskRight = mr
          applyMask(registration.wrapperEl, ml, mr)
        }
      }
    },
    { rootMargin: '50px' }
  )
  if (wrapperRef.value) intersectObs.observe(wrapperRef.value)
})

onUnmounted(() => {
  if (resizeObs) resizeObs.disconnect()
  if (mutationObs) mutationObs.disconnect()
  if (intersectObs) intersectObs.disconnect()
  if (registration) { unregister(registration); registration = null }
})
</script>

<style scoped>
.marquee-wrapper {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
}

.marquee-content {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  will-change: transform;
}
</style>
