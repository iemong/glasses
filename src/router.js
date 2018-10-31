import Vue from "vue";
import Router from "vue-router";
import Sound from "./views/SoundPage.vue";

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: "/",
      name: "sound",
      component: Sound
    }
  ]
});
