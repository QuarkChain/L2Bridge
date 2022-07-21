import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from '../components/Home.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    redirect: 'send',
  },
  {
    path: '/send',
    name: 'Home',
    component: Home,
  }
];

const router = new VueRouter({
  routes,
});

export default router;
