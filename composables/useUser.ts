
import { useRoute } from "vue-router";

// composables/useUser.js
export const useUserId = () => {
  const route = useRoute();
  return route.params.id || localStorage.getItem("user_id");
};

