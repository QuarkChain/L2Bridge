import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);
export default new Vuex.Store({
  state: {
    chainId: '',
    account: '',
  },
  mutations: {
    chainMutation: (state, payload) => state.chainId = payload,
    accountMutation:  (state, payload) => state.account = payload,
  },
  actions: {
    setChainId: ({ commit }, payload) => commit('chainMutation', payload),
    setAccount: ({ commit }, payload) => commit('accountMutation', payload),
  },
  modules: {
  },
});
