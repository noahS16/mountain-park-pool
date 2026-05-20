import Splide from '@splidejs/splide'
import '@splidejs/splide/css'


const splide = new Splide('#hero-carousel', {
  type: 'loop',
  autoplay: true,
  interval: 5000,
  pauseOnHover: true,
  arrows: true,
  pagination: true,
}).mount()
