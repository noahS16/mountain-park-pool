document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    const item = header.closest('.accordion-item')
    const body = item.querySelector('.accordion-body')
    const chevron = item.querySelector('.accordion-chevron')
    const isOpen = item.classList.contains('accordion-open')

    // close all
    document.querySelectorAll('.accordion-item').forEach(i => {
      i.classList.remove('accordion-open')
      i.querySelector('.accordion-body').style.maxHeight = '0px'
      i.querySelector('.accordion-chevron').style.transform = ''
      i.querySelector('.accordion-header').setAttribute('aria-expanded', 'false')
    })

    if (!isOpen) {
      item.classList.add('accordion-open')
      body.style.maxHeight = body.scrollHeight + 'px'
      chevron.style.transform = 'rotate(180deg)'
      header.setAttribute('aria-expanded', 'true')
    }
  })
})

// document.addEventListener('click', (e) => {
//   console.log('clicked element:', e.target)
// })