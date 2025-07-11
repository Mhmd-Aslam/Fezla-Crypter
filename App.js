import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import EncryptScreen from './screens/EncryptScreen';
import DecryptScreen from './screens/DecryptScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Encrypt" component={EncryptScreen} />
        <Tab.Screen name="Decrypt" component={DecryptScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}